import { useEffect, useRef, useState } from "react";
import { CsvTable } from "./components/CsvTable";
import { parseCsv, serializeCsv } from "./lib/csv";
import { loadLatestSpeedcamRecords } from "./lib/loadSpeedcams";
import { calculateStats, findNewSpeedCamRecords } from "./lib/speedcam";
import {
  canPickExistingCsv,
  pickExistingCsv,
  readSavedCsv,
  writeSavedCsv,
} from "./lib/storage";
import type { SpeedCamRecord } from "./types";

type TabId = "new" | "loaded" | "saved";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "new", label: "New Items" },
  { id: "loaded", label: "Loaded CSV" },
  { id: "saved", label: "Saved CSV" },
];

function logError(
  context: string,
  error: unknown,
  fallbackMessage: string,
): string {
  const message = error instanceof Error ? error.message : fallbackMessage;
  console.log(`${context}: ${message}`, error);
  return message;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("new");
  const [loadedRecords, setLoadedRecords] = useState<SpeedCamRecord[]>([]);
  const [savedRecords, setSavedRecords] = useState<SpeedCamRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSelectingExisting, setIsSelectingExisting] = useState(false);
  const sharedTableScrollRef = useRef({ top: 0, left: 0 });

  function handleTableScrollPositionChange(position: {
    top: number;
    left: number;
  }) {
    sharedTableScrollRef.current = position;
  }

  async function refreshSavedRecords() {
    const result = await readSavedCsv();
    const records = result.content ? parseCsv(result.content) : [];

    setSavedRecords(records);
  }

  useEffect(() => {
    void refreshSavedRecords().catch((error: unknown) => {
      logError(
        "Saved CSV read failed",
        error,
        "Unable to read the saved CSV file.",
      );
    });
  }, []);

  async function handleLoadClick() {
    setIsLoading(true);

    try {
      const records = await loadLatestSpeedcamRecords();
      setLoadedRecords(records);
      setActiveTab("new");
      console.log(
        `Loaded ${records.length} speedcam rows from the live KML source.`,
      );
    } catch (error) {
      logError("KML load failed", error, "Unable to load the KML file.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveClick() {
    if (loadedRecords.length === 0) {
      console.log(
        "CSV save skipped: Load the latest speedcam data before saving.",
      );
      return;
    }

    setIsSaving(true);

    try {
      const csvText = serializeCsv(loadedRecords);
      const result = await writeSavedCsv(csvText);
      await refreshSavedRecords();
      setActiveTab("saved");
      console.log(`Saved ${loadedRecords.length} rows to ${result.path}.`);
    } catch (error) {
      logError("CSV save failed", error, "Unable to save the CSV file.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSelectExistingClick() {
    setIsSelectingExisting(true);

    try {
      const result = await pickExistingCsv();
      const records = parseCsv(result.content);

      setSavedRecords(records);
      console.log(`Loaded ${records.length} rows from ${result.path}.`);
    } catch (error) {
      logError(
        "Existing CSV load failed",
        error,
        "Unable to load an existing CSV file.",
      );
    } finally {
      setIsSelectingExisting(false);
    }
  }

  const stats = calculateStats(loadedRecords, savedRecords);
  const newRecords = findNewSpeedCamRecords(loadedRecords, savedRecords);
  const statisticsMessage =
    loadedRecords.length === 0
      ? 'Press "Load New" to compare the latest KML data with the saved CSV.'
      : "No new items were found in the loaded KML data.";

  return (
    <div className="app-shell">
      <section className="content-panel">
        <div className="button-row">
          <button
            className="primary-button"
            onClick={handleLoadClick}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Load New"}
          </button>
          <button
            className="secondary-button"
            onClick={handleSaveClick}
            disabled={isSaving || loadedRecords.length === 0}
          >
            {isSaving ? "Saving..." : "Save to file"}
          </button>
        </div>

        <div
          className={`content-group${activeTab === "new" ? " is-statistics-view" : " is-table-view"}`}
        >
          <div
            className="tab-row"
            role="tablist"
            aria-label="Speedcam data tabs"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-button${activeTab === tab.id ? " is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "new" ? (
            <div className="statistics-tab">
              <div className="stats-grid">
                <article className="stat-card">
                  <span className="stat-label">Loaded from KML</span>
                  <strong>{stats.loadedCount}</strong>
                </article>
                <article className="stat-card">
                  <span className="stat-label">Rows in saved speedcam.csv</span>
                  <strong>{stats.savedCount}</strong>
                </article>
              </div>

              <div className="new-items-panel">
                {newRecords.length === 0 ? (
                  <p className="section-note">{statisticsMessage}</p>
                ) : null}
                <CsvTable
                  records={newRecords}
                  emptyMessage={statisticsMessage}
                  emptyTableMessage="No new items to display."
                />
              </div>
            </div>
          ) : null}

          {activeTab === "loaded" ? (
            <CsvTable
              records={loadedRecords}
              emptyMessage='Press "Load New" to download and parse the KML source.'
              scrollPosition={sharedTableScrollRef.current}
              onScrollPositionChange={handleTableScrollPositionChange}
            />
          ) : null}

          {activeTab === "saved" ? (
            <div className="saved-tab">
              <CsvTable
                records={savedRecords}
                emptyMessage="No saved CSV is available yet. Save the current data or choose an existing device CSV."
                scrollPosition={sharedTableScrollRef.current}
                onScrollPositionChange={handleTableScrollPositionChange}
              />
              {canPickExistingCsv() ? (
                <button
                  className="ghost-button"
                  onClick={handleSelectExistingClick}
                  disabled={isSelectingExisting}
                >
                  {isSelectingExisting
                    ? "Opening Android picker..."
                    : "Select existing CSV on device"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
