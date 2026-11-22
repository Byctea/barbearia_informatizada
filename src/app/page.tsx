const metrics = [
  { label: "Agendamentos hoje", value: "—", hint: "A agenda será ativada na Fase 4" },
  { label: "Clientes cadastrados", value: "—", hint: "Cadastros entram na Fase 3" },
  { label: "Receita do mês", value: "R$ —", hint: "Movimentação financeira na Fase 6" },
];

const modules = [
  { number: "01", title: "Agenda", description: "Solicitações e horários do dia", status: "Em preparação" },
  { number: "02", title: "Clientes", description: "Cadastro, histórico e fidelidade", status: "Próxima entrega" },
  { number: "03", title: "Serviços e produtos", description: "Catálogo e controle de estoque", status: "Planejado" },
];

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-5 sm:px-8 sm:py-9">
      <header className="flex items-center justify-between border-b border-[var(--border)] pb-5">
        <a href="#inicio" className="flex items-center gap-3" aria-label="Barber Bar início">
          <span className="grid size-11 place-items-center rounded-xl border border-[var(--accent)]/50 bg-[var(--accent)]/10 text-lg font-bold text-[var(--accent)]">B</span>
          <span><span className="block text-lg font-semibold tracking-wide">BARBER <span className="text-[var(--accent)]">BAR</span></span><span className="text-xs text-[var(--muted)]">Gestão da barbearia</span></span>
        </a>
        <div className="flex items-center gap-2"><a href="/entrar" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--foreground)] transition hover:border-[var(--accent)]">Entrar</a><a href="/cadastro" className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#18130d] transition hover:bg-[var(--accent-strong)]">Criar conta</a></div>
      </header>

      <section id="inicio" className="grid gap-8 py-10 lg:grid-cols-[1.4fr_0.8fr] lg:items-end lg:py-16">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Painel administrativo</p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Sua barbearia, <span className="text-[var(--accent)]">bem organizada.</span></h1>
          <p className="mt-4 max-w-xl leading-7 text-[var(--muted)]">Acompanhe os módulos do Barber Bar. Esta base já está preparada para crescer; as funções serão habilitadas fase a fase.</p>
        </div>
        <div className="rounded-2xl border border-[var(--accent)]/25 bg-[linear-gradient(135deg,rgba(215,168,110,.13),rgba(25,24,22,.85))] p-5 sm:p-6">
          <p className="text-sm text-[var(--muted)]">Próximo passo do projeto</p>
          <p className="mt-2 text-xl font-semibold">Cadastro de clientes e serviços</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">A estrutura inicial foi preparada. Na próxima fase, começaremos os cadastros que alimentam a agenda.</p>
          <span className="mt-4 inline-flex rounded-full border border-[var(--accent)]/40 px-3 py-1 text-xs text-[var(--accent-strong)]">Fase 3 planejada</span>
        </div>
      </section>

      <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-3">
        {metrics.map((metric) => <article key={metric.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm text-[var(--muted)]">{metric.label}</p><p className="mt-4 text-3xl font-semibold">{metric.value}</p><p className="mt-2 text-xs text-[var(--muted)]">{metric.hint}</p>
        </article>)}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Visão geral</p><h2 className="mt-1 text-2xl font-semibold">Módulos do sistema</h2></div><span className="text-xs text-[var(--muted)]">Atualizado conforme as fases</span></div>
        <div className="grid gap-3 md:grid-cols-3">
          {modules.map((module) => <article key={module.number} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent)]/50">
            <div className="flex items-center justify-between"><span className="text-xs tracking-widest text-[var(--accent)]">{module.number}</span><span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-[var(--muted)]">{module.status}</span></div>
            <h3 className="mt-5 text-lg font-semibold">{module.title}</h3><p className="mt-1 text-sm text-[var(--muted)]">{module.description}</p>
          </article>)}
        </div>
      </section>

      <footer className="mt-12 border-t border-[var(--border)] py-5 text-xs text-[var(--muted)]">Barber Bar <span className="px-1">·</span> Horário de atendimento: America/Bahia <span className="px-1">·</span> Versão inicial</footer>
    </main>
  );
}
