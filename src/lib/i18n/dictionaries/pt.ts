import type { Dict } from './es'

export const pt: Dict = {
  common: {
    appName: 'MIA',
    back: 'Voltar',
    save: 'Salvar',
    cancel: 'Cancelar',
    reset: 'Restaurar',
    loading: 'Carregando…',
    error: 'Ocorreu um erro',
  },
  nav: {
    today: 'Hoje',
    commandCenter: 'Central de Comando',
    commandCenterQuestion: 'como está meu negócio?',
    relations: 'Relacionamentos',
    relationsQuestion: 'o que está acontecendo com meus clientes?',
    learn: 'Aprenda',
    memory: 'Memória',
    memoryQuestion: 'o que a MIA descobriu?',
    thinking: 'Pensamento',
    thinkingQuestion: 'o que está analisando?',
    grow: 'Cresça',
    lab: 'Laboratório',
    labQuestion: 'como ela pode melhorar?',
    settings: 'Configurações',
    adjustments: 'Ajustes',
    connections: 'Conexões',
    connectionsTitle: 'canais e integrações',
    advanced: 'Avançado',
    council: 'Conselho',
    councilTitle: 'agentes, permissões e integrações',
    health: 'Saúde',
    healthTitle: 'status do sistema e verificações automáticas',
    accessibility: 'Acessibilidade',
    accessibilityTitle: 'acessibilidade, ergonomia e conforto visual',
  },
  topbar: {
    toggleLight: 'Mudar para modo claro',
    toggleDark: 'Mudar para modo escuro',
    language: 'Idioma',
  },
  dashboard: {
    welcome: 'Bem-vindo',
    hi: 'Olá',
    greetingSubtitleEmpty:
      'Conte-me sobre seu negócio para que eu possa começar a acompanhar você.',
    letsStart: 'Vamos começar!',
    tellAboutBusiness:
      'Conte-me sobre seu negócio para que eu possa começar a trabalhar com você.',
    tellMia: 'Contar à MIA sobre meu negócio',
    createAssistantTitle: 'Crie sua primeira assistente',
    createAssistantSubtitle:
      'Vamos configurar a MIA para que ela comece a conhecer seus clientes.',
    createMia: 'Criar MIA',
    activeConversations: 'Conversas ativas',
    heartOfMia: 'O coração da MIA batendo pelo seu negócio',
    last24h: 'Nas últimas 24 horas',
    newCustomers: 'Novos clientes',
    peopleMiaMeets: 'Pessoas que a MIA está conhecendo',
    arrivedToday: 'Chegaram hoje',
    messagesHandled: 'Mensagens gerenciadas',
    conversationsCared: 'Conversas que a MIA cuidou por você',
    today: 'Hoje',
    readiness: 'Preparação',
    howReadyMia: 'O quão pronta a MIA está para atender',
    overallScore: 'Pontuação geral de acompanhamento',
    explore: 'Explore o que a MIA está fazendo por você',
    memoryTitle: 'Memória',
    memoryDescription:
      'Tudo o que a MIA aprendeu sobre seu negócio e seus clientes',
    thinkingTitle: 'Pensamento',
    thinkingDescription:
      'Sinais, ideias e estratégias que a MIA está analisando para você',
    labTitle: 'Laboratório',
    labDescription: 'Treine a MIA com simulações para melhorar cada dia',
  },
  weeklyReport: {
    title: 'Meu relatório semanal',
    noReport: 'Ainda não tenho um relatório semanal.',
    autoMonday: 'Os relatórios são gerados automaticamente toda segunda-feira.',
    generate: 'Gerar meu primeiro relatório',
    generating: 'Gerando meu relatório semanal…',
    generateFailed: 'Não foi possível gerar o relatório.',
    conversations: 'conversas',
    newFacts: 'coisas novas',
    products: 'produtos',
    preparation: 'preparação',
    recommendations: 'Recomendações',
  },
  sales: {
    title: 'Vendas e Conversão',
    todaySales: 'Vendas hoje',
    todayRevenue: 'Receita hoje',
    weekSales: 'Vendas desta semana',
    conversion: 'Conversão',
    topProducts: 'Produtos mais vendidos',
  },
  signals: {
    calm: 'A MIA está tranquila',
    observing: 'A MIA encontrou algo interessante',
    attention: 'A MIA precisa da sua atenção',
    decision: 'A MIA precisa da sua decisão',
  },
  moduleStatus: {
    noNews: 'Sem novidades',
    newToday: (count: number) => `${count} nova${count === 1 ? '' : 's'} hoje`,
    analyzing: 'Em análise',
    hypotheses: (count: number) => `${count} hipóteses`,
    noSimulations: 'Sem simulações',
    score: (value: string) => `Score ${value}`,
  },
  auth: {
    loginTitle: 'Entrar',
    signupTitle: 'Criar conta',
  },
  accessibility: {
    title: 'Acessibilidade e Ergonomia',
    subtitle:
      'Ajuste como a MIA se parece e se sente para reduzir a fadiga visual. Suas preferências são salvas no seu perfil e aplicadas em todos os dispositivos.',
    layout: 'Disposição',
    layoutDescription:
      'Altere a posição da barra lateral para adaptar seu espaço de trabalho.',
    mirrorMode: 'Modo espelho',
    mirrorModeLabel: 'Barra lateral à direita',
    opticalComfort: 'Conforto óptico',
    opticalComfortDescription:
      'Reduza o contraste e a fadiga visual eliminando brancos e pretos puros.',
    opticalMode: 'Modo óptico antifadiga',
    opticalModeLabel: 'Paleta suave e anti-aliasing',
    typography: 'Tipografia',
    typographyDescription:
      'Selecione a espessura da fonte para facilitar a leitura.',
    fontWeight: 'Peso da fonte',
    fontWeightNormal: 'Normal',
    fontWeightMedium: 'Média',
    fontWeightBold: 'Negrito',
    colorTemperature: 'Temperatura de cor',
    colorTemperatureDescription:
      'Aplique um filtro quente ou frio a toda a interface.',
    color: 'Cor',
    colorNeutral: 'Neutra',
    colorWarm: 'Quente',
    colorCool: 'Fria',
    resetTitle: 'Restaurar preferências',
    resetDescription: 'Volte à disposição e paleta padrão.',
  },
  language: {
    title: 'Idioma',
    subtitle: 'Selecione o idioma da interface.',
  },
  ai: {
    personalityWarmClose: 'calorosa e próxima',
    personalityDistant: 'profissional e distante',
    personalityFormal: 'formal',
    personalityCasual: 'casual',
    personalityHumorous: 'com bom humor',
    personalitySerious: 'séria',
    personalityProactive: 'proativa em vendas',
    personalityConsultative: 'consultiva, não agressiva',
    personalityBalanced: 'equilibrada',
    noProducts: 'Ainda não há produtos cadastrados.',
    noPrice: 'sem preço definido',
    benefits: 'Benefícios',
    notSpecified: 'não especificados',
    faq: 'Perguntas frequentes',
    restrictions: 'Restrições',
    noRules: 'Ainda não há regras de venda definidas.',
    ruleTag: 'REGRA',
    priority: 'PRIORIDADE',
    imageAvailable:
      'Envie a imagem associada a este conhecimento quando o cliente tocar nesse tema. Ela é enviada automaticamente na primeira vez da conversa; você só precisa mencionar na sua resposta que está compartilhando uma imagem sobre isso.',
    knowledgeQuestion: 'Pergunta',
    knowledgeAnswer: 'Resposta',
    reason: 'Razão',
    finalDecision: 'DECISÃO FINAL',
    lessonRule: 'regra',
    lessonInstruction: 'instrução',
    lessonKnowledge: 'conhecimento',
    removedDiscarded: '(removido/descartado)',
    yourObjective: 'Seu Objetivo',
    objectiveText:
      'Ajudar os clientes a encontrar o que precisam, respeitando as regras do negócio. Vender com naturalidade, sem pressionar artificialmente.',
    yourPersonality: 'Sua Personalidade',
    personalityStyle: 'Seu estilo é',
    communicationStyle: 'Estilo de Comunicação',
    communicationStyleText: 'Você mantém um estilo',
    fundamentalRules: 'Regras Fundamentais',
    neverInvent:
      'NUNCA invente informações que não estejam no seu conhecimento.',
    ifUnsure:
      'Se não souber algo, diga: "Deixe-me verificar isso com a equipe."',
    askCity: 'Sempre pergunte a cidade antes de prometer entrega. NUNCA prometa datas, prazos nem dias de entrega que não estejam no seu conhecimento.',
    noDiscounts:
      'Não mencione descontos a menos que o cliente pergunte ou estejam nas regras.',
    humanHandoff:
      'Se o cliente pedir para falar com alguém, indique que você pode conectá-lo com a equipe.',
    conflictResolution: 'Resolução de Conflitos',
    conflictIntro:
      'Se encontrar informações contraditórias entre diferentes fontes, aplique esta ordem de autoridade:',
    immutableDecisions:
      'As DECISÕES IMUTÁVEIS [IMUTÁVEL] do negócio sempre prevalecem sobre qualquer outra fonte.',
    manualInstructions:
      'As INSTRUÇÕES MANUAIS [MANUAL] do dono do negócio prevalecem sobre regras e conhecimento.',
    higherPriorityRules:
      'As REGRAS DE VENDA [REGRA] com prioridade mais alta prevalecem sobre as de prioridade mais baixa.',
    reviewedKnowledge:
      'O CONHECIMENTO REVISADO [CORREÇÃO] prevalece sobre conhecimento importado [DOCUMENTO].',
    recentKnowledge:
      'O CONHECIMENTO RECENTE prevalece sobre o antigo (data de criação).',
    statisticalPatterns:
      'Os PADRÕES estatísticos [PADRÃO] têm a menor autoridade.',
    conflictPersists:
      'Se após aplicar essas regras o conflito persistir:',
    priceConflict:
      'Se afetar preços: Pergunte ao cliente qual fonte consultou.',
    businessRuleConflict:
      'Se afetar regras de negócio: Escale para um consultor humano.',
    harmlessConflict:
      'Se for uma contradição sem risco: Use a informação mais recente.',
    autonomy: 'Autonomia',
    canDo: 'Você pode:',
    explainProducts: 'explicar produtos',
    resolveDoubts: 'resolver dúvidas',
    recommendOptions: 'recomendar opções',
    answerFaqs: 'responder perguntas frequentes',
    cannotDo: 'Você não pode:',
    changePrices: 'mudar preços',
    promiseExceptions: 'prometer exceções',
    inventPromotions: 'inventar promoções',
    confirmOrders: 'confirmar pedidos sem validar regras',
    giveUnverified: 'dar informações que não estão no seu conhecimento',
    businessInfo: 'Informações do Negócio',
    noBusinessInfo:
      'As informações do negócio ainda não foram configuradas.',
    targetCustomers: 'Clientes-alvo',
    differentiators: 'O que nos diferencia',
    products: 'Produtos',
    salesRules: 'Regras de Venda',
    additionalInstructions: 'Instruções Adicionais',
    additionalKnowledge: 'Conhecimento Adicional',
    businessMemory: 'Memória Interna do Negócio',
    customerMemory: 'Memória do Cliente',
    whatIveLearned: 'O que aprendi com você',
    lastCorrections: 'Últimas correções que você me ensinou:',
    finalInstruction: 'Instrução Final',
    finalInstructionText:
      'ANTES DE RESPONDER: Revise ativamente se há informações contraditórias entre as seções anteriores. Se encontrar contradições, aplique a ordem de autoridade da Resolução de Conflitos. Não misture regras incompatíveis.',
    toneNote:
      'A marca definiu seu tom como. Este tom é o guia geral da marca. Se houver conflito com seu estilo pessoal, priorize a personalidade do assistente para a interação direta, mas mantenha o tom da marca como estrutura geral.',
    whatsappTone:
      'CANAL WHATSAPP:\n' +
      '- Responda em no máximo 2-3 linhas, com tom caloroso e empático.\n' +
      '- Use o nome do cliente quando o conhecer.\n' +
      '- Valide a dúvida ou o ceticismo do cliente antes de responder (ex.: "Entendo que você queira ter certeza").\n' +
      '- Não use negrito, listas longas ou muitos emojis; a formatação aparece como texto simples.',
    waOrderCapture:
      'CAPTURA DE PEDIDOS PELO WHATSAPP:\n' +
      '- Quando o cliente mostrar intenção de compra, capture de forma natural nome, telefone, endereço e produto: peça UM dado por vez, integrado à conversa. Nada de interrogatórios nem listas ("preciso do seu nome, do seu telefone, do seu endereço...").\n' +
      '- Se o cliente já enviou todos os dados (nome, endereço, cidade, produto), NÃO peça mais nada: repita-os em 2-3 linhas e peça confirmação explícita ("Confirmo seu pedido? Produto X, em nome de..., entrega em..."). Não dê o pedido como confirmado até o cliente dizer sim.\n' +
      '- Valide o pedido contra as regras do negócio ANTES de confirmar (preços, restrições, zonas de envio). Se algo não puder validar, escale.\n' +
      '- ENTREGA: cite dias ou horários de entrega SOMENTE se aparecerem no seu conhecimento. Se o dono carregou, use-os como estão. Se NÃO estiverem, não os invente: diga algo crível como "confirmamos os dias de entrega ao coordenar seu pedido".\n' +
      '- Nunca prometa "chega amanhã", "está pronto hoje" nem qualquer prazo que não esteja escrito no seu conhecimento.\n' +
      '- Quando o pedido for confirmado, feche o ciclo de confiança dizendo o que vem a seguir: "Pronto! Confirmamos a entrega pelo WhatsApp". Não dê datas que você não conhece.\n' +
      '- Não invente descontos, promoções nem exceções para fechar a venda.',
    intentTagDirective:
      'ETIQUETA DE INTENÇÃO (INTENT_TAG):\n' +
      '- Se o sistema indicar uma etiqueta de intenção, use-a para responder de forma concisa e focada.\n' +
      '- Se um menu interativo com botões ou lista for exibido, NÃO o repita na sua resposta: o cliente o vê na tela. Apenas responda o conteúdo de forma breve e natural.',
    waClosingHook:
      'Deixo seu pedido pronto? Confirma seus dados e a equipe coordena a entrega.',
    youAre: 'Você é',
    salesAssistantOf: 'a assistente de vendas de',
    closingPolicy: 'Política de Fechamento Comercial',
    closingProactive:
      'Você é um consultor comercial proativo: guia o cliente em direção à decisão.\n' +
      '- A partir do segundo turno (ou quando a dúvida principal for resolvida), NÃO feche com perguntas abertas passivas como "Em que mais posso ajudar?" ou "Tem mais alguma dúvida?".\n' +
      '- Feche cada resposta informativa com um gancho comercial fluido ou uma pergunta de controle que leve ao próximo passo (ex.: "Agendamos seu pedido?", "Deixo seu pedido pronto? Confirma seus dados e a equipe coordena a entrega.").\n' +
      '- Atue como um consultor especialista que elimina dúvidas e facilita a decisão, sem soar como telemarketing agressivo.\n' +
      '- Nunca pressione artificialmente: a prioridade é ajudar o cliente a decidir com naturalidade.',
    closingConsultative:
      'Você é um consultor comercial consultivo: acompanha e facilita a decisão do cliente.\n' +
      '- Quando a dúvida principal for resolvida, evite perguntas abertas passivas como "Em que mais posso ajudar?"; prefira fechar com uma sugestão concreta e útil.\n' +
      '- Proponha o próximo passo como um consultor, sem empurrar: ofereça uma opção concreta (ex.: "Posso deixar seu pedido preparado se quiser", "Deixo seu pedido pronto e coordenamos a entrega?").\n' +
      '- Nunca pressione artificialmente: a decisão final é do cliente.',
    closingBalanced:
      'Você é um consultor comercial equilibrado: guia o cliente em direção à decisão com naturalidade.\n' +
      '- A partir do segundo turno (ou quando a dúvida principal for resolvida), evite perguntas abertas passivas como "Em que mais posso ajudar?"; feche com um gancho comercial fluido ou uma pergunta de controle que facilite o próximo passo (ex.: "Agendamos seu pedido?", "Deixo seu pedido pronto? Confirma seus dados e a equipe coordena a entrega.").\n' +
      '- Atue como um consultor especialista que elimina dúvidas, sem soar como telemarketing agressivo.\n' +
      '- Nunca pressione artificialmente: a prioridade é ajudar o cliente a decidir.',
    deliveryPromiseRule:
      'NUNCA prometa datas, prazos nem horários de entrega que não estejam no seu conhecimento. Se o negócio tiver dias de entrega carregados, cite-os como estão. Se não tiver, diga que a equipe coordena a entrega e confirma pelo WhatsApp, sem comprometer datas.',
  },
}
