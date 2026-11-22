"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { AdminResource } from "@/lib/admin-records";

type Row = Record<string, unknown> & { id: string };
type ApiResult = { data?: Row[]; error?: string; issues?: Record<string, string[] | undefined> };
type Field = { key: string; label: string; type?: "text" | "email" | "tel" | "date" | "textarea" | "number" | "money" | "checkbox" | "select" | "image"; min?: number; max?: number; step?: string; options?: [string, string][]; hint?: string };
const definitions: Record<AdminResource, { fields: Field[]; columns: [string, string, ((row: Row) => string)?][] }> = {
  customers: {
    fields: [
      { key: "full_name", label: "Nome completo", min: 2, max: 120 }, { key: "phone", label: "Telefone / WhatsApp", type: "tel", min: 8, max: 24 },
      { key: "email", label: "E-mail", type: "email" }, { key: "birth_date", label: "Data de nascimento", type: "date" },
      { key: "preferred_return_days", label: "Intervalo ideal de retorno (dias)", type: "number", min: 1, max: 365, hint: "Opcional" },
      { key: "haircut_preference", label: "Preferência de corte", type: "textarea", max: 500 }, { key: "notes", label: "Observações", type: "textarea", max: 1000 },
      { key: "consent_status", label: "Consentimento para uso dos dados", type: "select", options: [["UNKNOWN", "Não informado"], ["GRANTED", "Autorizado"], ["REVOKED", "Revogado"]] },
      { key: "is_loyalty_member", label: "Participa do programa de fidelidade", type: "checkbox" },
    ],
    columns: [["full_name", "Cliente"], ["phone", "Telefone"], ["email", "E-mail"], ["preferred_return_days", "Retorno", (row) => row.preferred_return_days ? `${row.preferred_return_days} dias` : "—"], ["is_loyalty_member", "Fidelidade", (row) => row.is_loyalty_member ? "Participante" : "—"]],
  },
  services: {
    fields: [
      { key: "name", label: "Nome do serviço", min: 2, max: 100 }, { key: "description", label: "Descrição", type: "textarea", max: 500 },
      { key: "duration_minutes", label: "Duração (minutos)", type: "number", min: 5, max: 600 },
      { key: "price_cents", label: "Preço de venda (R$)", type: "money", min: 0, step: "0.01" },
      { key: "estimated_cost_cents", label: "Custo estimado (R$)", type: "money", min: 0, step: "0.01" },
    ],
    columns: [["name", "Serviço"], ["duration_minutes", "Duração", (row) => `${row.duration_minutes} min`], ["price_cents", "Preço", (row) => money(row.price_cents)], ["estimated_cost_cents", "Custo", (row) => money(row.estimated_cost_cents)]],
  },
  products: {
    fields: [
      { key: "name", label: "Nome do produto", min: 2, max: 120 }, { key: "category", label: "Categoria", min: 2, max: 80 }, { key: "image_url", label: "Foto do produto", type: "image", hint: "Opcional. Selecione uma imagem; ela será reduzida automaticamente." },
      { key: "cost_cents", label: "Custo unitário (R$)", type: "money", min: 0, step: "0.01" },
      { key: "sale_price_cents", label: "Preço de venda (R$)", type: "money", min: 0, step: "0.01" },
      { key: "stock_quantity", label: "Estoque atual", type: "number", min: 0, max: 1000000 },
      { key: "minimum_stock", label: "Estoque mínimo", type: "number", min: 0, max: 1000000 },
    ],
    columns: [["name", "Produto"], ["category", "Categoria"], ["image_url", "Foto", (row) => row.image_url ? "Cadastrada" : "Sem foto"], ["sale_price_cents", "Preço", (row) => money(row.sale_price_cents)], ["stock_quantity", "Estoque", (row) => `${row.stock_quantity} un.`], ["minimum_stock", "Mínimo", (row) => `${row.minimum_stock} un.`]],
  },
  barbers: {
    fields: [
      { key: "display_name", label: "Nome do profissional", min: 2, max: 120 },
      { key: "phone", label: "Telefone / WhatsApp", type: "tel", max: 24, hint: "Opcional" },
      { key: "barber_type", label: "Vínculo", type: "select", options: [["EMPLOYEE", "Funcionário"], ["PARTNER", "Parceiro"]] },
    ],
    columns: [["display_name", "Profissional"], ["phone", "Telefone"], ["barber_type", "Vínculo", (row) => row.barber_type === "PARTNER" ? "Parceiro" : "Funcionário"]],
  },
};
const money = (value: unknown) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0) / 100);
const blank = (resource: AdminResource) => Object.fromEntries(definitions[resource].fields.map(({ key, type }) => [key, type === "checkbox" ? false : key === "barber_type" ? "EMPLOYEE" : ""]));
const displayValue = (row: Row, field: Field) => field.type === "money" ? (Number(row[field.key] ?? 0) / 100).toFixed(2) : field.type === "checkbox" ? Boolean(row[field.key]) : String(row[field.key] ?? "");

export function AdminRecords({ resource, title, hasMembership }: { resource: AdminResource; title: string; hasMembership: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Record<string, unknown>>(() => blank(resource));
  const [editing, setEditing] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const fields = definitions[resource].fields;
  const endpoint = useMemo(() => `/api/admin/${resource}`, [resource]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint);
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar os cadastros.");
      setRows(result.data ?? []);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao carregar."); }
    finally { setLoading(false); }
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]);

  const beginEdit = (row: Row) => { setEditing(row); setForm(Object.fromEntries(fields.map((field) => [field.key, displayValue(row, field)]))); setNotice(""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const cancelEdit = () => { setEditing(null); setForm(blank(resource)); setNotice(""); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setNotice("");
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const value = form[field.key];
      payload[field.key] = field.type === "money" ? Math.round(Number(value || 0) * 100) : field.type === "number" ? (value === "" ? null : Number(value)) : value;
    }
    try {
      const response = await fetch(editing ? `${endpoint}/${editing.id}` : endpoint, { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar.");
      setEditing(null); setForm(blank(resource)); setNotice(editing ? "Cadastro atualizado." : "Cadastro criado."); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao salvar."); }
    finally { setSaving(false); }
  };
  const deactivate = async (row: Row) => {
    const labelKey = resource === "customers" ? "full_name" : resource === "barbers" ? "display_name" : "name";
    if (!window.confirm(`Deseja inativar/remover "${String(row[labelKey])}"?`)) return;
    setNotice("");
    try {
      const response = await fetch(`${endpoint}/${row.id}`, { method: "DELETE" }); const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível inativar.");
      setNotice("Cadastro inativado."); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao inativar."); }
  };

  if (!hasMembership) return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-8"><a href="/dashboard" className="text-[var(--accent)]">← Voltar ao painel</a><div className="mt-8 rounded-2xl border border-red-900 bg-red-950/40 p-6"><h1 className="text-xl font-semibold">Unidade administrativa não configurada</h1><p className="mt-2 text-sm text-[var(--muted)]">A conta tem perfil de administrador, mas ainda precisa ser vinculada a uma unidade. Configure o vínculo local seguindo o guia da Fase 3.</p></div></main>;

  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-8">
    <header className="flex items-center justify-between border-b border-[var(--border)] pb-5"><a href="/dashboard" className="text-[var(--accent)]">← Painel</a><a href="/" className="font-semibold">BARBER <span className="text-[var(--accent)]">BAR</span></a></header>
    <section className="py-8"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">CADASTROS</p><h1 className="mt-2 text-3xl font-semibold">{title}</h1><p className="mt-2 text-sm text-[var(--muted)]">Os valores são salvos na unidade administrativa vinculada à sua conta.</p>
      {notice && <p role="status" className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">{notice}</p>}
      <form onSubmit={submit} className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><h2 className="mb-5 text-lg font-semibold">{editing ? `Editar ${title.toLowerCase().slice(0, -1)}` : `Novo cadastro`}</h2><div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => <label key={field.key} className={`block text-sm text-[var(--muted)] ${field.type === "textarea" ? "sm:col-span-2" : ""} ${field.type === "checkbox" ? "flex items-center gap-3 rounded-lg border border-[var(--border)] p-3" : ""}`}>
          {field.type === "checkbox" ? <><input type="checkbox" checked={Boolean(form[field.key])} onChange={(event) => setForm({ ...form, [field.key]: event.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />{field.label}</> : <>{field.label}{field.type === "textarea" ? <textarea value={String(form[field.key] ?? "")} maxLength={field.max} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} className="mt-2 min-h-24 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]" /> : field.type === "image" ? <><input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; if (!file.type.startsWith("image/")) { setNotice("Escolha um arquivo de imagem."); return; } try { const bitmap = await createImageBitmap(file); const scale = Math.min(1, 720 / Math.max(bitmap.width, bitmap.height)); const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale)); const context = canvas.getContext("2d"); if (!context) throw new Error("Não foi possível processar a imagem."); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); const data = canvas.toDataURL("image/webp", 0.78); if (data.length > 350000) throw new Error("A imagem ficou grande demais. Escolha uma imagem menor."); setForm((current) => ({ ...current, [field.key]: data })); setNotice(""); } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível carregar a imagem."); } }} className="mt-2 block w-full text-sm" />{Boolean(form[field.key]) && <div className="mt-3 flex items-center gap-3"><img src={String(form[field.key])} alt="Prévia do produto" className="h-20 w-20 rounded-lg object-cover" /><button type="button" onClick={() => setForm((current) => ({ ...current, [field.key]: "" }))} className="text-sm text-red-300">Remover foto</button></div>}</> : field.type === "select" ? <select value={String(form[field.key] ?? "UNKNOWN")} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-3 text-[var(--foreground)]">{field.options?.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <input required={field.key === "full_name" || (field.key === "phone" && resource !== "barbers") || field.key === "display_name" || field.key === "name" || field.key === "category" || field.key === "duration_minutes" || field.key === "price_cents" || field.key === "estimated_cost_cents" || field.key === "cost_cents" || field.key === "sale_price_cents" || field.key === "stock_quantity" || field.key === "minimum_stock"} type={field.type === "money" ? "number" : field.type ?? "text"} min={field.min} max={field.max} step={field.step} value={String(form[field.key] ?? "")} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-3 text-[var(--foreground)]" />}{field.hint && <span className="mt-1 block text-xs">{field.hint}</span>}</>}
        </label>)}
      </div><div className="mt-5 flex flex-wrap gap-3"><button disabled={saving} className="rounded-lg bg-[var(--accent)] px-5 py-3 font-semibold text-black disabled:opacity-60">{saving ? "Salvando…" : editing ? "Salvar alterações" : "Adicionar cadastro"}</button>{editing && <button type="button" onClick={cancelEdit} className="rounded-lg border border-[var(--border)] px-5 py-3">Cancelar</button>}</div></form>
      <section className="mt-8"><div className="flex items-end justify-between"><div><h2 className="text-xl font-semibold">{title} cadastrados</h2><p className="mt-1 text-sm text-[var(--muted)]">{rows.length} registro(s) ativo(s)</p></div><button onClick={() => void load()} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Atualizar</button></div>
        {loading ? <p className="py-10 text-center text-[var(--muted)]">Carregando…</p> : rows.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">Nenhum cadastro ainda. Use o formulário acima para começar.</p> : <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[var(--surface)] text-[var(--muted)]"><tr>{definitions[resource].columns.map(([key, label]) => <th key={key} className="px-4 py-3 font-medium">{label}</th>)}<th className="px-4 py-3 font-medium">Ações</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-[var(--border)]">{definitions[resource].columns.map(([key, _label, format]) => <td key={key} className="px-4 py-3">{format ? format(row) : String(row[key] ?? "—")}</td>)}<td className="px-4 py-3"><div className="flex gap-3"><button onClick={() => beginEdit(row)} className="text-[var(--accent)]">Editar</button><button onClick={() => void deactivate(row)} className="text-red-300">Inativar</button></div></td></tr>)}</tbody></table></div>}
      </section>
    </section>
  </main>;
}
