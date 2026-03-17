import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import {
  EmptyState,
  PaginationBar,
} from "@/components/backoffice/Workbench";
import {
  getNumberParam,
  getStringParam,
  updateSearchParams,
  getNullableNumberParam,
} from "@/lib/search";
import {
  listRepMaterials,
  listRepMaterialFilters,
} from "@/services/rep";
import { Material } from "@/types/rep";
import {
  LoadingState,
  ErrorState,
} from "./components/RepHelpers";
import { SelectedMaterialsPanel } from "./components/SelectedMaterialsPanel";
import { MaterialCard } from "./components/MaterialCard";
import { MaterialFilters } from "./components/MaterialFilters";
import { CreateSessionDialog } from "./components/CreateSessionDialog";
import { AddToExistingSessionDialog } from "./components/AddToExistingSessionDialog";
import { MaterialPreviewDialog } from "./components/MaterialPreviewDialog";

export function RepLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = getStringParam(searchParams, "q");
  const page = getNumberParam(searchParams, "page");
  const type = getStringParam(searchParams, "type", "all");
  const managerId = getNullableNumberParam(searchParams, "manager_id");
  const brandId = getNullableNumberParam(searchParams, "brand_id");

  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [isAddToExistingOpen, setIsAddToExistingOpen] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);

  const materialsQuery = useQuery({
    queryKey: ["rep", "materials", q, page, type, managerId, brandId],
    queryFn: () =>
      listRepMaterials({
        q,
        page,
        type: type === "all" ? undefined : type,
        manager_id: managerId ?? undefined,
        brand_id: brandId ?? undefined,
      }),
  });

  const filtersOptionsQuery = useQuery({
    queryKey: ["rep", "material-filters"],
    queryFn: () => listRepMaterialFilters(),
  });

  const toggleMaterial = (id: number) => {
    setSelectedMaterialIds((curr) => {
      const isSelected = curr.includes(id);
      if (isSelected) return curr.filter((x) => x !== id);
      return [...curr, id];
    });
  };

  const [selectedMaterials, setSelectedMaterials] = useState<Material[]>([]);

  useEffect(() => {
    if (materialsQuery.data?.items) {
      const currentItems = materialsQuery.data.items;
      setSelectedMaterials((prev) => {
        const newItems = [...prev];
        selectedMaterialIds.forEach((id) => {
          if (!newItems.find((m) => m.id === id)) {
            const found = currentItems.find((m) => m.id === id);
            if (found) newItems.push(found);
          }
        });
        return newItems.filter((m) => selectedMaterialIds.includes(m.id));
      });
    }
  }, [selectedMaterialIds, materialsQuery.data?.items]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500 pb-24 lg:pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">
            Biblioteca de Materiales
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Explora contenido aprobado y selecciona piezas para tu visita médica.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <MaterialFilters
          query={q ?? ""}
          type={type}
          managerId={managerId}
          brandId={brandId}
          filtersOptions={filtersOptionsQuery.data}
          isLoadingFilters={filtersOptionsQuery.isLoading}
          onQueryChange={(value) =>
            setSearchParams((current) =>
              updateSearchParams(current, { q: value || null, page: 1 }),
            )
          }
          onTypeChange={(value) =>
            setSearchParams((current) =>
              updateSearchParams(current, {
                type: value === "all" ? null : value,
                page: 1,
              }),
            )
          }
          onManagerChange={(val) =>
            setSearchParams((current) =>
              updateSearchParams(current, {
                manager_id: val?.toString() || null,
                brand_id: null,
                page: 1,
              }),
            )
          }
          onBrandChange={(val) =>
            setSearchParams((current) =>
              updateSearchParams(current, {
                brand_id: val?.toString() || null,
                page: 1,
              }),
            )
          }
          onClear={() => setSearchParams({})}
        />

        {materialsQuery.isLoading && (
          <LoadingState message="Cargando biblioteca..." />
        )}
        {materialsQuery.isError && (
          <ErrorState message="No se pudo cargar la biblioteca." />
        )}

        {!materialsQuery.isLoading &&
          !materialsQuery.isError &&
          materialsQuery.data?.items.length === 0 && (
            <EmptyState
              title="Sin materiales"
              description="Aún no hay materiales aprobados para ti."
            />
          )}

        {!materialsQuery.isLoading &&
          !materialsQuery.isError &&
          (materialsQuery.data?.items.length ?? 0) > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {materialsQuery.data?.items.map((item) => (
                <MaterialCard
                  key={item.id}
                  item={item}
                  isSelected={selectedMaterialIds.includes(item.id)}
                  onToggle={toggleMaterial}
                  onPreview={setPreviewMaterial}
                />
              ))}
            </div>
          )}

        <PaginationBar
          page={materialsQuery.data?.page ?? page}
          lastPage={materialsQuery.data?.last_page ?? 1}
          total={materialsQuery.data?.total ?? 0}
          onPageChange={(nextPage) =>
            setSearchParams((current) =>
              updateSearchParams(current, { page: nextPage }),
            )
          }
        />

        <SelectedMaterialsPanel
          selected={selectedMaterials}
          onNewSession={() => setIsSessionDialogOpen(true)}
          onAddToExisting={() => setIsAddToExistingOpen(true)}
          onRemove={toggleMaterial}
        />
      </div>

      <CreateSessionDialog
        open={isSessionDialogOpen}
        onOpenChange={setIsSessionDialogOpen}
        selectedMaterialIds={selectedMaterialIds}
        onSuccess={() => setSelectedMaterialIds([])}
      />

      <AddToExistingSessionDialog
        open={isAddToExistingOpen}
        onOpenChange={setIsAddToExistingOpen}
        selectedMaterialIds={selectedMaterialIds}
        onSuccess={() => setSelectedMaterialIds([])}
      />

      <MaterialPreviewDialog
        material={previewMaterial}
        onClose={() => setPreviewMaterial(null)}
      />
    </div>
  );
}
