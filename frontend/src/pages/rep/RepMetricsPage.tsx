import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";

import { DatePicker } from "@/components/ui/DatePicker";
import { ErrorState } from "@/components/ui/ErrorState";
import { DateRangeCapNotice } from "@/components/backoffice/DateRangeCapNotice";
import { getNumberParam, getStringParam, updateSearchParams } from "@/lib/search";
import { capDateRangeToMaxDays, computeMaxEndDate, computeMinStartDate } from "@/lib/dateRangeCap";
import { MAX_METRICS_TREND_DAYS } from "@/lib/metricsTrendConfig";
import { useAuth } from "@/contexts/useAuth";
import {
  getRepDeviceSplit,
  getRepHourHistogram,
  getRepMetricsSummary,
  getRepOpenTrend,
  listRepMetricSessions,
  listRepTopMaterials,
  listRepUnopenedMaterials,
} from "@/services/repMetrics";
import { OpenRateHero } from "./components/OpenRateHero";
import { OpenTrendChart } from "./components/OpenTrendChart";
import { HourHistogramChart } from "./components/HourHistogramChart";
import { DeviceSplitCard } from "./components/DeviceSplitCard";
import { NeverOpenedList } from "./components/NeverOpenedList";
import { TopMaterialsList } from "./components/TopMaterialsList";
import { UnopenedMaterialsList } from "./components/UnopenedMaterialsList";
import { EffectiveRangeNotice } from "./components/EffectiveRangeNotice";

/**
 * Orchestrator for `/rep/metrics` (sdd/rep-metrics-module Phase 4).
 * Every filter lives in the URL (persisted, shareable, reload-safe — per
 * AGENTS.md). Widget order follows the design's page hierarchy: the "does
 * the doctor open it?" hero leads, the actionable never-opened follow-up
 * list comes second, then trend/hour/device/top-materials support it.
 */
export function RepMetricsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawStartDate = getStringParam(searchParams, "start_date");
  const rawEndDate = getStringParam(searchParams, "end_date");
  const neverPage = getNumberParam(searchParams, "never_page");
  const materialsPage = getNumberParam(searchParams, "materials_page");
  const unopenedPage = getNumberParam(searchParams, "unopened_page");

  // Same cap as the backoffice dashboard (MetricsTrendConfig::MAX_TREND_DAYS,
  // mirrored client-side) so a shared/old URL never silently requests a
  // wider trend window than the backend will actually return.
  const { startDate: cappedStartDate, endDate: cappedEndDate, wasCapped } =
    capDateRangeToMaxDays(rawStartDate, rawEndDate);
  const startDate = cappedStartDate ?? "";
  const endDate = cappedEndDate ?? "";

  useEffect(() => {
    if (wasCapped && rawStartDate !== startDate) {
      setSearchParams(
        (prev) =>
          updateSearchParams(prev, {
            start_date: startDate,
            never_page: null,
            unopened_page: null,
          }),
        { replace: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wasCapped, startDate, rawStartDate]);

  const dateFilters = {
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  };

  const setDateFilter = (key: "start_date" | "end_date", value: string) => {
    setSearchParams(
      (prev) =>
        updateSearchParams(prev, {
          [key]: value || null,
          never_page: null,
          materials_page: null,
          unopened_page: null,
        }),
      { replace: true },
    );
  };

  const clearFilters = () => {
    setSearchParams(
      (prev) =>
        updateSearchParams(prev, {
          start_date: null,
          end_date: null,
          never_page: null,
          materials_page: null,
          unopened_page: null,
        }),
      { replace: true },
    );
  };

  const hasFilters = Boolean(startDate || endDate);

  const summaryQuery = useQuery({
    queryKey: ["rep-metrics", "summary", startDate, endDate],
    queryFn: () => getRepMetricsSummary(dateFilters),
  });

  const openTrendQuery = useQuery({
    queryKey: ["rep-metrics", "open-trend", startDate, endDate],
    queryFn: () => getRepOpenTrend(dateFilters),
  });

  const hourHistogramQuery = useQuery({
    queryKey: ["rep-metrics", "hour-histogram", startDate, endDate],
    queryFn: () => getRepHourHistogram(dateFilters),
  });

  const deviceSplitQuery = useQuery({
    queryKey: ["rep-metrics", "device-split", startDate, endDate],
    queryFn: () => getRepDeviceSplit(dateFilters),
  });

  const neverOpenedQuery = useQuery({
    queryKey: ["rep-metrics", "sessions", "never", startDate, endDate, neverPage],
    queryFn: () =>
      listRepMetricSessions({ ...dateFilters, status: "never", page: neverPage }),
  });

  const topMaterialsQuery = useQuery({
    queryKey: ["rep-metrics", "top-materials", startDate, endDate, materialsPage],
    queryFn: () => listRepTopMaterials({ ...dateFilters, page: materialsPage }),
  });

  const unopenedMaterialsQuery = useQuery({
    queryKey: ["rep-metrics", "unopened-materials", startDate, endDate, unopenedPage],
    queryFn: () => listRepUnopenedMaterials({ ...dateFilters, page: unopenedPage }),
  });

  const isFullyEmpty =
    !summaryQuery.isLoading &&
    !summaryQuery.isError &&
    (summaryQuery.data?.sessions_total ?? 0) === 0 &&
    !hasFilters;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">
            Mis Métricas
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seguimiento de tus sesiones enviadas y consumidas por el médico.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Desde</label>
            <DatePicker
              value={startDate}
              onChange={(val) => setDateFilter("start_date", val || "")}
              placeholder="Desde"
              className="w-[160px]"
              minDate={computeMinStartDate(endDate || undefined)}
              maxDate={endDate || undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Hasta</label>
            <DatePicker
              value={endDate}
              onChange={(val) => setDateFilter("end_date", val || "")}
              placeholder="Hasta"
              className="w-[160px]"
              minDate={startDate || undefined}
              maxDate={computeMaxEndDate(startDate || undefined)}
            />
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {wasCapped && <DateRangeCapNotice maxDays={MAX_METRICS_TREND_DAYS} />}
      <EffectiveRangeNotice
        hasFilters={hasFilters}
        startDate={startDate}
        endDate={endDate}
        maxTrendDays={MAX_METRICS_TREND_DAYS}
      />

      {summaryQuery.isError && (
        <ErrorState message="No se pudieron cargar tus métricas. Intenta de nuevo." />
      )}

      {isFullyEmpty ? (
        <OpenRateHero summary={summaryQuery.data} isLoading={summaryQuery.isLoading} />
      ) : (
        <div className="flex flex-col gap-8">
          <OpenRateHero summary={summaryQuery.data} isLoading={summaryQuery.isLoading} />

          <NeverOpenedList
            data={neverOpenedQuery.data}
            isLoading={neverOpenedQuery.isLoading}
            isError={neverOpenedQuery.isError}
            page={neverPage}
            onPageChange={(next) =>
              setSearchParams((prev) => updateSearchParams(prev, { never_page: next }))
            }
            timezone={user?.organization_timezone}
          />

          <UnopenedMaterialsList
            data={unopenedMaterialsQuery.data}
            isLoading={unopenedMaterialsQuery.isLoading}
            isError={unopenedMaterialsQuery.isError}
            page={unopenedPage}
            onPageChange={(next) =>
              setSearchParams((prev) => updateSearchParams(prev, { unopened_page: next }))
            }
            timezone={user?.organization_timezone}
          />

          <OpenTrendChart data={openTrendQuery.data} isLoading={openTrendQuery.isLoading} />

          <div className="grid gap-8 lg:grid-cols-2">
            <HourHistogramChart
              data={hourHistogramQuery.data}
              isLoading={hourHistogramQuery.isLoading}
            />
            <DeviceSplitCard data={deviceSplitQuery.data} isLoading={deviceSplitQuery.isLoading} />
          </div>

          <TopMaterialsList
            data={topMaterialsQuery.data}
            isLoading={topMaterialsQuery.isLoading}
            isError={topMaterialsQuery.isError}
            page={materialsPage}
            onPageChange={(next) =>
              setSearchParams((prev) => updateSearchParams(prev, { materials_page: next }))
            }
          />
        </div>
      )}
    </div>
  );
}
