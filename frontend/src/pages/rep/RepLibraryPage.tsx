import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Link2,
  Copy,
  CheckCircle2,
  PackagePlus,
  Eye,
  ExternalLink,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams, Link } from "react-router-dom";

import {
  EmptyState,
  PaginationBar,
  SearchToolbar,
} from "@/components/backoffice/Workbench";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

import {
  getNumberParam,
  getStringParam,
  updateSearchParams,
  getNullableNumberParam,
} from "@/lib/search";
import { formatDateTime } from "@/lib/utils";
import {
  listRepMaterials,
  createRepSession,
  listRepSessions,
  addMaterialsToSession,
  listRepMaterialFilters,
} from "@/services/rep";
import { Material, RepSession } from "@/types/rep";
import { ApiResponse, MaterialResource } from "@/types";
import {
  LoadingState,
  ErrorState,
  MaterialTypeLabel,
} from "./components/RepHelpers";
import { SelectedMaterialsPanel } from "./components/SelectedMaterialsPanel";
import api from "@/services/api";
import { Select } from "@/components/ui/Select";

export function RepLibraryPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = getStringParam(searchParams, "q");
  const page = getNumberParam(searchParams, "page");
  const type = getStringParam(searchParams, "type", "all");
  const managerId = getNullableNumberParam(searchParams, "manager_id");
  const brandId = getNullableNumberParam(searchParams, "brand_id");

  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    doctor_name: "",
    notes: "",
  });
  const [createdSessionToken, setCreatedSessionToken] = useState<string | null>(
    null,
  );

  // For "add to existing session" flow
  const [isAddToExistingOpen, setIsAddToExistingOpen] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [targetSessionForAdd, setTargetSessionForAdd] =
    useState<RepSession | null>(null);
  const [addDone, setAddDone] = useState(false);

  // Preview state
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
  const [previewResource, setPreviewResource] =
    useState<MaterialResource | null>(null);

  useEffect(() => {
    if (!previewMaterial) {
      setPreviewResource(null);
      return;
    }
    const fetchResource = async () => {
      try {
        if (previewMaterial.type === "pdf") {
          setPreviewResource({
            type: "pdf",
            url: `/api/v1/public/material/${previewMaterial.id}/resource`,
          });
          return;
        }
        const res = await api.get<ApiResponse<MaterialResource>>(
          `/public/material/${previewMaterial.id}/resource`,
        );
        setPreviewResource(res.data);
      } catch (err) {
        toast.error("No se pudo cargar la previsualización");
      }
    };
    void fetchResource();
  }, [previewMaterial]);

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

  // Fetch recent sessions to allow "add to existing"
  const sessionsQuery = useQuery({
    queryKey: ["rep", "sessions", 1, sessionSearch],
    queryFn: () => listRepSessions({ page: 1, q: sessionSearch || undefined }),
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      if (selectedMaterialIds.length === 0)
        throw new Error("Selecciona al menos un material.");
      return createRepSession({
        doctor_name: sessionForm.doctor_name || undefined,
        notes: sessionForm.notes || undefined,
        material_ids: selectedMaterialIds,
      });
    },
    onSuccess: (data) => {
      toast.success("Sesión médica creada exitosamente.");
      setCreatedSessionToken(data.session.doctor_token);
      setSelectedMaterialIds([]);
      setSessionForm({ doctor_name: "", notes: "" });
      void queryClient.invalidateQueries({ queryKey: ["rep", "sessions"] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Error al crear la sesión.";
      toast.error(message);
    },
  });

  const addToExistingMutation = useMutation({
    mutationFn: () => {
      if (!targetSessionForAdd) throw new Error("No hay sesión seleccionada.");
      return addMaterialsToSession(targetSessionForAdd.id, selectedMaterialIds);
    },
    onSuccess: () => {
      toast.success("Materiales agregados a la sesión.");
      setAddDone(true);
      setSelectedMaterialIds([]);
      void queryClient.invalidateQueries({ queryKey: ["rep", "sessions"] });
    },
    onError: (err) => {
      const msg =
        err instanceof Error ? err.message : "Error al agregar materiales.";
      toast.error(msg);
    },
  });

  const toggleMaterial = (id: number) => {
    setSelectedMaterialIds((curr) => {
      const isSelected = curr.includes(id);
      if (isSelected) return curr.filter((x) => x !== id);
      return [...curr, id];
    });
  };

  // To keep full material objects even if we paginate away
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
        // Remove those no longer in selectedMaterialIds
        return newItems.filter((m) => selectedMaterialIds.includes(m.id));
      });
    }
  }, [selectedMaterialIds, materialsQuery.data?.items]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Enlace copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  const handleCloseSessionDialog = () => {
    setIsSessionDialogOpen(false);
    setCreatedSessionToken(null);
  };

  const handleCloseAddToExisting = () => {
    setIsAddToExistingOpen(false);
    setTargetSessionForAdd(null);
    setSessionSearch("");
    setAddDone(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500 pb-24 lg:pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">
            Biblioteca de Materiales
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Explora contenido aprobado y selecciona piezas para tu visita
            médica.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Material List */}
        <div className="flex flex-col gap-6">
          <SearchToolbar
            value={q ?? ""}
            onChange={(value) =>
              setSearchParams((current) =>
                updateSearchParams(current, { q: value || null, page: 1 }),
              )
            }
            placeholder="Buscar material..."
            extra={
              <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                {(q || type !== "all" || managerId || brandId) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchParams({})}
                    className="h-11 px-3 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpiar
                  </Button>
                )}

                <Select
                  value={type}
                  onChange={(e) =>
                    setSearchParams((current) =>
                      updateSearchParams(current, {
                        type: e.target.value === "all" ? null : e.target.value,
                        page: 1,
                      }),
                    )
                  }
                  className="h-11 w-full min-w-[120px] sm:w-auto"
                >
                  <option value="all">Tipos</option>
                  <option value="pdf">PDF</option>
                  <option value="video">Video</option>
                  <option value="link">Link</option>
                </Select>

                <Select
                  value={managerId?.toString() ?? ""}
                  onChange={(e) => {
                    const nextManager = e.target.value || null;
                    setSearchParams((current) =>
                      updateSearchParams(current, {
                        manager_id: nextManager,
                        brand_id: null,
                        page: 1,
                      }),
                    );
                  }}
                  className="h-11 w-full min-w-[180px] sm:w-auto"
                  disabled={filtersOptionsQuery.isLoading}
                >
                  <option value="">Gerentes</option>
                  {filtersOptionsQuery.data?.managers.map((m) => (
                    <option key={m.manager_id} value={m.manager_id}>
                      {m.manager_name}
                    </option>
                  ))}
                </Select>

                <Select
                  value={brandId?.toString() ?? ""}
                  onChange={(e) =>
                    setSearchParams((current) =>
                      updateSearchParams(current, {
                        brand_id: e.target.value || null,
                        page: 1,
                      }),
                    )
                  }
                  className="h-11 w-full min-w-[160px] sm:w-auto"
                  disabled={filtersOptionsQuery.isLoading}
                >
                  <option value="">Marcas</option>
                  {filtersOptionsQuery.data?.brands
                    .filter((b) => !managerId || b.manager_id === managerId)
                    .map((b) => (
                      <option key={`${b.id}-${b.manager_id}`} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </Select>
              </div>
            }
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
                {materialsQuery.data?.items.map((item) => {
                  const isSelected = selectedMaterialIds.includes(item.id);
                  return (
                    <Card
                      key={item.id}
                      className={`group cursor-pointer overflow-hidden transition-all duration-300 ${isSelected ? "ring-2 ring-primary bg-primary/5" : "hover:border-primary/50 hover:shadow-md"}`}
                      onClick={() => toggleMaterial(item.id)}
                    >
                      <div className="relative aspect-[5/4] bg-muted border-b border-border/10 overflow-hidden">
                        {item.cover_path ? (
                          <img
                            src={`/api/v1/public/material/${item.id}/cover`}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                            alt={item.title}
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center opacity-20 transition-transform duration-500 group-hover:scale-110">
                            <FileText className="h-12 w-12" />
                            <span className="text-[10px] font-bold mt-2 uppercase tracking-widest">
                              {item.type}
                            </span>
                          </div>
                        )}
                        <div className="absolute top-3 left-3">
                          <MaterialTypeLabel type={item.type} />
                        </div>
                        <div
                          className={`absolute top-3 right-3 h-5 w-5 rounded-full border flex items-center justify-center shadow-sm ${isSelected ? "bg-primary border-primary" : "bg-background/80 border-muted-foreground/30"}`}
                        >
                          {isSelected && (
                            <div className="h-2 w-2 rounded-full bg-background" />
                          )}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 w-full shadow-lg border-none hover:bg-white hover:text-black"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewMaterial(item);
                            }}
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5" />{" "}
                            Previsualización rápida
                          </Button>
                        </div>
                      </div>
                      <CardContent className="p-4 pt-3">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
                          Cód. {item.id}
                        </p>
                        <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
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
        </div>

        {/* Selected materials panel (Replaces right side col) */}
        <SelectedMaterialsPanel
          selected={selectedMaterials}
          onNewSession={() => setIsSessionDialogOpen(true)}
          onRemove={toggleMaterial}
        />
      </div>

      {/* ── Create new session dialog ───────────────────────────────── */}
      <Dialog
        open={isSessionDialogOpen}
        onOpenChange={handleCloseSessionDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Visita Médica</DialogTitle>
            <DialogDescription>
              Registra notas o a quién visitas (opcional). El enlace que generes
              incluirá los {selectedMaterialIds.length} materiales
              seleccionados.
            </DialogDescription>
          </DialogHeader>

          {!createdSessionToken ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void createSessionMutation.mutateAsync();
              }}
              className="space-y-5 mt-4"
            >
              <Input
                label="Médico (Opcional)"
                value={sessionForm.doctor_name}
                onChange={(e) =>
                  setSessionForm((c) => ({ ...c, doctor_name: e.target.value }))
                }
                placeholder="Dr. Juan Pérez"
              />
              <Textarea
                label="Notas de la visita (Opcional)"
                value={sessionForm.notes}
                onChange={(e) =>
                  setSessionForm((c) => ({ ...c, notes: e.target.value }))
                }
                placeholder="Interés en cardiopatías..."
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseSessionDialog}
                >
                  Cancelar
                </Button>
                <Button type="submit" loading={createSessionMutation.isPending}>
                  Generar Link
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-6">
              <div className="p-4 bg-success/10 text-success rounded-full">
                <Link2 className="h-8 w-8" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg text-foreground">
                  ¡Sesión lista para compartir!
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Comparte este enlace con el médico. No requiere inicio de
                  sesión.
                </p>
              </div>
              <div className="flex w-full items-center gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/public/visit/${createdSessionToken}`}
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={() =>
                    copyToClipboard(
                      `${window.location.origin}/public/visit/${createdSessionToken}`,
                    )
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex w-full gap-3 pt-4 border-t border-border mt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCloseSessionDialog}
                >
                  Cerrar
                </Button>
                <Button className="flex-1" asChild>
                  <Link
                    to={`/public/visit/${createdSessionToken}`}
                    target="_blank"
                  >
                    Abrir link
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add to existing session dialog ──────────────────────────── */}
      <Dialog
        open={isAddToExistingOpen}
        onOpenChange={handleCloseAddToExisting}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar a sesión existente</DialogTitle>
            <DialogDescription>
              Selecciona la sesión a la que deseas agregar los{" "}
              {selectedMaterialIds.length} materiales seleccionados.
            </DialogDescription>
          </DialogHeader>

          {addDone ? (
            <div className="mt-4 flex flex-col items-center gap-6 py-4">
              <div className="p-4 bg-success/10 text-success rounded-full">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg text-foreground">
                  ¡Materiales agregados!
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  El enlace de la sesión ya incluye los nuevos materiales.
                </p>
              </div>
              {targetSessionForAdd && (
                <div className="flex w-full items-center gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/public/visit/${targetSessionForAdd.doctor_token}`}
                    className="flex-1"
                  />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      copyToClipboard(
                        `${window.location.origin}/public/visit/${targetSessionForAdd!.doctor_token}`,
                      )
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Button className="w-full" onClick={handleCloseAddToExisting}>
                Cerrar
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              <SearchToolbar
                value={sessionSearch}
                onChange={setSessionSearch}
                placeholder="Buscar médico..."
              />
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {sessionsQuery.isLoading && (
                  <LoadingState message="Cargando sesiones..." />
                )}
                {sessionsQuery.data?.items.map((session) => (
                  <div
                    key={session.id}
                    onClick={() =>
                      setTargetSessionForAdd((s) =>
                        s?.id === session.id ? null : session,
                      )
                    }
                    className={`flex items-center gap-3 cursor-pointer rounded-2xl border p-4 transition-all ${targetSessionForAdd?.id === session.id ? "ring-2 ring-primary border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                  >
                    <div
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${targetSessionForAdd?.id === session.id ? "bg-primary border-primary" : "border-muted-foreground/30"}`}
                    >
                      {targetSessionForAdd?.id === session.id && (
                        <div className="h-2 w-2 rounded-full bg-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {session.doctor_name || (
                          <span className="italic text-muted-foreground">
                            Sin nombre
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(session.created_at)}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      ID {session.id}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={handleCloseAddToExisting}>
                  Cancelar
                </Button>
                <Button
                  disabled={!targetSessionForAdd}
                  loading={addToExistingMutation.isPending}
                  onClick={() => void addToExistingMutation.mutateAsync()}
                >
                  <PackagePlus className="mr-2 h-4 w-4" /> Agregar materiales
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ────────────────────────────────────────── */}
      <Dialog
        open={!!previewMaterial}
        onOpenChange={(open) => !open && setPreviewMaterial(null)}
      >
        <DialogContent className="max-w-4xl w-[90vw] p-0 overflow-hidden bg-background gap-0 sm:rounded-xl">
          <DialogHeader className="p-4 border-b bg-muted/20">
            <DialogTitle className="text-lg font-semibold">
              {previewMaterial?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col relative w-full h-[75vh] bg-muted/5">
            {!previewResource ? (
              <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : previewResource.type === "pdf" ? (
              <iframe
                title={previewMaterial?.title}
                src={`${previewResource.url}#toolbar=0`}
                className="h-full w-full border-none bg-muted/20"
              />
            ) : previewResource.type === "video" ? (
              <div className="flex h-full w-full items-center justify-center bg-black">
                <iframe
                  title={previewMaterial?.title}
                  src={previewResource.embed_url ?? previewResource.url}
                  className="w-full aspect-video max-h-full border-none"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : previewResource.type === "link" ? (
              <div className="flex h-full flex-col items-center justify-center p-10 text-center">
                <div className="rounded-full bg-amber-500/10 p-8 mb-6 ring-1 ring-amber-500/20">
                  <ExternalLink className="h-12 w-12 text-amber-600" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">
                  {previewMaterial?.title}
                </h3>
                <p className="mt-4 max-w-md text-base text-muted-foreground mb-8">
                  Este material es un enlace externo. Ábrelo para visualizar el
                  contenido en una nueva pestaña.
                </p>
                <Button
                  size="lg"
                  onClick={() =>
                    window.open(
                      previewResource.url ??
                        previewMaterial?.external_url ??
                        "",
                      "_blank",
                    )
                  }
                >
                  Abrir enlace externo <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Contenido no disponible.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
