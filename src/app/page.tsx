const metrics = [
  { label: "Agendamentos de hoje", value: "1.000", hint: "Volume demonstrativo da plataforma" },
  { label: "Clientes cadastrados", value: "500", hint: "Base ilustrativa de clientes" },
  { label: "Receita no mês", value: "R$ 230 mil", hint: "Indicador demonstrativo da plataforma" },
];

const modules = [
  ["01", "Agenda", "Organize horários, disponibilidade da equipe, bloqueios e solicitações de agendamento."],
  ["02", "Clientes", "Cadastre clientes, consulte preferências, consentimentos e histórico de atendimentos."],
  ["03", "Equipe", "Gerencie barbeiros, seus contatos, vínculos profissionais e horários de trabalho."],
  ["04", "Serviços", "Defina os serviços oferecidos, duração, preço e custo estimado."],
  ["05", "Produtos e estoque", "Cadastre produtos, acompanhe saldo, compras, vendas e alertas de reposição."],
  ["06", "Atendimentos", "Registre serviços realizados e mantenha o histórico de cada visita."],
  ["07", "Vendas e pedidos", "Lance vendas da loja, acompanhe pedidos de clientes e atualize sua situação."],
  ["08", "Financeiro", "Acompanhe receitas, despesas, pagamentos e resultado por período."],
  ["09", "Fidelidade", "Configure pontos ou visitas e reconheça clientes recorrentes."],
  ["10", "Relatórios", "Analise desempenho, ticket médio, serviços, produtos e retorno dos clientes."],
  ["11", "Painel da plataforma", "Cadastre barbearias e unidades e convide seus administradores."],
].map(([number, title, description]) => ({ number, title, description }));

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-5 sm:px-8 sm:py-9">
      <header className="flex items-center justify-between border-b border-[var(--border)] pb-5">
        <a href="#inicio" className="flex items-center gap-3" aria-label="Barber Flow início">
          <span className="grid size-11 place-items-center rounded-xl border border-[var(--accent)]/50 bg-[var(--accent)]/10 text-lg font-bold text-[var(--accent)]">B</span>
          <span><span className="block text-lg font-semibold tracking-wide">BARBER <span className="text-[var(--accent)]">FLOW</span></span><span className="text-xs text-[var(--muted)]">Gestão de barbearias</span></span>
        </a>
        <div className="flex items-center gap-2"><a href="/entrar" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm transition hover:border-[var(--accent)]">Entrar</a><a href="/cadastro" className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#18130d] transition hover:bg-[var(--accent-strong)]">Criar conta</a></div>
      </header>

      <section id="inicio" className="grid gap-8 py-10 lg:grid-cols-[1.4fr_0.8fr] lg:items-center lg:py-16">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Gestão simples para sua barbearia</p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Sua barbearia, <span className="text-[var(--accent)]">em um só fluxo.</span></h1>
          <p className="mt-4 max-w-xl leading-7 text-[var(--muted)]">O Barber Flow reúne agenda, clientes, equipe, vendas e gestão financeira em um só lugar. Clientes podem encontrar uma barbearia e solicitar vínculo; o acesso da equipe é liberado pelo responsável.</p>
          <div className="mt-6 flex flex-wrap gap-3"><a href="/cadastro" className="rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-[#18130d]">Encontrar uma barbearia</a><a href="https://wa.me/5571982264690?text=Ol%C3%A1%2C%20quero%20saber%20mais%20sobre%20o%20Barber%20Flow" target="_blank" rel="noreferrer" className="rounded-xl border border-[var(--border)] px-5 py-3">Falar sobre o sistema</a></div>
        </div>
        <div className="relative mx-auto flex min-h-64 w-full max-w-md items-center justify-center overflow-hidden rounded-3xl border border-[var(--accent)]/25 bg-[radial-gradient(ellipse_at_50%_100%,rgba(215,168,110,.22),rgba(25,24,22,.65)_65%)] p-6">
          <div aria-hidden="true" className="barber-mascot h-56 w-56" />
          <div className="absolute bottom-4 rounded-full border border-[var(--accent)]/30 bg-black/45 px-4 py-2 text-xs text-[var(--accent-strong)]">Seu parceiro na rotina</div>
        </div>
      </section>

      <section aria-label="Indicadores demonstrativos" className="grid gap-3 sm:grid-cols-3">
        {metrics.map((metric) => <article key={metric.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><p className="text-sm text-[var(--muted)]">{metric.label}</p><p className="mt-4 text-3xl font-semibold">{metric.value}</p><p className="mt-2 text-xs text-[var(--muted)]">{metric.hint}</p></article>)}
      </section>

      <section className="mt-10">
        <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Visão geral</p><h2 className="mt-1 text-2xl font-semibold">Módulos do Barber Flow</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Conheça as áreas que apoiam a operação diária e a administração da plataforma.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => <article key={module.number} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent)]/50"><span className="text-xs tracking-widest text-[var(--accent)]">{module.number}</span><h3 className="mt-3 text-lg font-semibold">{module.title}</h3><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{module.description}</p></article>)}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-[var(--accent)]/25 bg-[var(--surface)] p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Orçamentos e informações</p><h2 className="mt-2 text-xl font-semibold">Quer usar o Barber Flow na sua barbearia?</h2><p className="mt-2 text-sm text-[var(--muted)]">Entre em contato pelo WhatsApp e solicite um orçamento.</p></div><a href="https://wa.me/5571982264690?text=Ol%C3%A1%2C%20gostaria%20de%20solicitar%20um%20or%C3%A7amento%20do%20Barber%20Flow" target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-[#18130d] sm:mt-0">WhatsApp: (71) 98226-4690</a></section>

      <footer className="mt-12 border-t border-[var(--border)] py-5 text-xs text-[var(--muted)]">Barber Flow <span className="px-1">·</span> Gestão de barbearias <span className="px-1">·</span> Horário de atendimento: America/Bahia</footer>
    </main>
  );
}
