import { Stethoscope, Plus, PackagePlus } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Material } from "@/types/rep";
import { MaterialTypeLabel } from "@/components/ui/MaterialTypeLabel";

export function SelectedMaterialsPanel({
  selected,
  onNewSession,
  onRemove,
}: {
  selected: Material[];
  onNewSession: () => void;
  onRemove: (id: number) => void;
}) {
  const count = selected.length;
  if (count === 0) return null;

  const content = (
    <div className="flex flex-col bg-background/95 backdrop-blur-xl border border-border/50 shadow-2xl rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-primary/10 h-full">
      <div className="p-6 border-b border-border/40 bg-gradient-to-br from-primary/10 via-background to-transparent relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Stethoscope className="h-12 w-12 text-primary" />
        </div>
        <div className="flex items-center gap-2.5 mb-1.5 relative">
          <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
          <h3 className="font-bold text-lg tracking-tight text-foreground">
            Selección Actual
          </h3>
        </div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em] relative">
          {count} material{count > 1 ? "es" : ""} listo{count > 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 p-6 pt-4 overflow-y-auto space-y-3 custom-scrollbar min-h-0">
        {selected.map((m) => (
          <div
            key={m.id}
            className="group relative text-sm bg-background/50 border border-border/50 p-3.5 rounded-2xl shadow-sm hover:border-primary/40 hover:bg-background transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <MaterialTypeLabel type={m.type} />
                  <span className="text-[10px] font-mono text-muted-foreground">
                    #{m.id}
                  </span>
                </div>
                <span className="block font-semibold text-foreground leading-snug group-hover:text-primary transition-colors pr-2">
                  {m.title}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(m.id);
                }}
                className="h-7 w-7 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-white transition-colors shrink-0"
              >
                <Plus className="h-3.5 w-3.5 rotate-45" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 bg-muted/30 border-t border-border/40 flex flex-col gap-3 mt-auto">
        <Button
          className="w-full rounded-2xl shadow-xl shadow-primary/20 h-11 text-sm font-semibold"
          onClick={onNewSession}
        >
          <Plus className="mr-2 h-5 w-5" /> Nueva sesión
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop View: Absoluto a la izquierda (Fixed) */}
      <div
        className="hidden lg:block fixed bottom-8 w-80 z-40 max-h-[calc(100vh-8rem)] min-h-[400px] transition-all duration-300"
        style={{ left: "calc(var(--sidebar-width, 18rem) + 2.5rem)" }}
      >
        {content}
      </div>

      {/* Mobile & Tablet View: Bottom Drawer */}
      <div className="lg:hidden fixed bottom-6 inset-x-0 px-6 z-40">
        <Sheet>
          <SheetTrigger asChild>
            <button className="w-full h-16 bg-primary text-primary-foreground rounded-[1.5rem] shadow-[0_20px_50px_rgba(var(--primary-rgb),0.3)] flex items-center justify-between px-6 animate-in slide-in-from-bottom-8 duration-500 hover:scale-[1.02] active:scale-[0.98] transition-transform backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm">
                  {count}
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="font-bold text-base">Materiales listos</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-1">
                    Toca para gestionar
                  </span>
                </div>
              </div>
              <div className="bg-white/10 p-2 rounded-xl">
                <PackagePlus className="h-5 w-5" />
              </div>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-[3rem] p-0 h-[85vh] border-t-0 bg-transparent overflow-hidden"
          >
            <div className="h-full bg-background/95 backdrop-blur-2xl rounded-t-[3rem] border-t border-border/40 shadow-2xl flex flex-col">
              <div className="w-16 h-1.5 bg-border/40 mx-auto mt-5 rounded-full mb-2 shrink-0" />
              <div className="flex-1 min-h-0">{content}</div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
