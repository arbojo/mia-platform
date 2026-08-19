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
    catalog: 'Catálogo',
    catalogQuestion: 'produtos e suas mídias',
    grow: 'Cresça',
    lab: 'Laboratório',
    labQuestion: 'como ela pode melhorar?',
    delivery: 'Delivery',
    deliveryQuestion: 'entregadores e entregas',
    inventory: 'Inventário',
    inventoryQuestion: 'estoque e reposição',
    settings: 'Configurações',
    salesSettings: 'Configurações de Vendas',
    salesSettingsQuestion: 'como MIA confirma pedidos e cancelamentos',
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
  settings: {
    title: 'Configurações de Vendas',
    subtitle: 'Gerencie como MIA confirma pedidos e lida com cancelamentos',
    orderSection: 'Pedido',
    askAddress: 'Perguntar endereço de entrega',
    askPhone: 'Perguntar telefone de contato',
    confirmationSection: 'Confirmação',
    confirmationMessage: 'Mensagem de confirmação',
    cancellationSection: 'Cancelamento',
    allowCancellation: 'Permitir cancelamento pelo chat',
    cancellationWindow: 'Janela de cancelamento (horas)',
    cancellationMessage: 'Mensagem de cancelamento',
    variables: 'Variáveis disponíveis',
    preview: 'Visualização',
    save: 'Salvar configurações',
    saved: 'Configurações salvas',
    error: 'Erro ao salvar configurações',
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
      'NUNCA invente informações, preços, características nem produtos que não estejam explicitamente registrados no seu contexto de conhecimento ou catálogo.',
    offTopicBridge:
      'Se um cliente perguntar sobre temas alheios ao negócio (como curiosidades gerais, ciência, política ou assuntos não relacionados), não forneça informações externas: use-os amavelmente como uma ponte para reconduzir a conversa para os produtos ou soluções que este negócio oferece.',
    ifUnsure:
      'Se não souber algo específico do negócio ou um dado exato não estiver disponível nas suas fontes, responda honestamente com a diretriz atribuída (ex.: "Deixe-me verificar isso com a equipe") e mantenha firme o seu papel comercial.',
    knowledgeBoundary:
      'Seu conhecimento comercial está delimitado única e exclusivamente pelo catálogo, pelas regras de venda e pela documentação fornecida por este inquilino.',
    responseFormat: 'Formato de Resposta',
    responseFormatText:
      'Mantenha um tom próximo, profissional e focado no benefício do cliente.',
    recommendationFormat:
      'Ao recomendar um artigo, mencione seu nome, seu valor e destaque como ele resolve a necessidade específica usando os dados do catálogo.',
    askCity:
      'Pergunte a cidade SOMENTE quando o cliente pedir envio/entrega ou mostrar intenção de compra, e a cidade ainda não tiver sido mencionada. Se o cliente estiver em fase de investigação (preço, uso, benefícios, dúvidas), NÃO pergunte a cidade nem peça dados: responda primeiro. Se a cidade já for conhecida, não a pergunte de novo. NUNCA prometa datas, prazos nem dias de entrega que não estejam no seu conhecimento.',
    noDiscounts:
      'Não mencione descontos a menos que o cliente pergunte ou estejam nas regras.',
    humanHandoff:
      'Repasse humano quando a negociação exigir.',
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
      '- NUNCA diga "seu pedido está confirmado", "pronto" nem "vamos prosseguir" sem o "sim" explícito do cliente: use "Confirmo seu pedido?" e aguarde a resposta.\n' +
      '- ENDEREÇO: capture-o em UMA linha no formato "Rua e número, Col. <bairro>, <cidade>, <estado>" (adicione o CEP se o cliente der). Se o cliente misturar dados (ex.: o bairro junto com a rua), NÃO adivinhe o que é o quê: pergunte explicitamente. Antes de dar o pedido por pronto, repita o endereço completo capturado e confirme.\n' +
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
    salesPurpose:
      'Seu propósito principal é guiar o cliente, resolver suas dúvidas comerciais baseando-se estritamente no inventário e nas regras fornecidas, e reconduzir sempre a conversa para a venda ou a recomendação dos produtos do negócio.',
    closingPolicy: 'Política de Fechamento Comercial',
    closingProactive:
      'Você é um consultor comercial proativo: guia o cliente em direção à decisão.\n' +
      '- A partir do segundo turno (ou quando a dúvida principal for resolvida), NÃO feche com perguntas abertas passivas como "Em que mais posso ajudar?" ou "Tem mais alguma dúvida?".\n' +
      '- Feche cada resposta informativa com um gancho comercial fluido ou uma pergunta de controle que leve ao próximo passo (ex.: "Agendamos seu pedido?", "Deixo seu pedido pronto? Confirma seus dados e a equipe coordena a entrega.").\n' +
      '- Se o cliente continuar fazendo perguntas (fase de investigação), responda e SEGURE o fechamento: não peça dados pessoais nem feche até haver um sinal de intenção de compra (preço, envio, pagamento ou pedido de compra).\n' +
      '- Não repita o mesmo gancho nem a mesma pergunta em mensagens consecutivas: varie a redação ou feche apenas quando for natural.\n' +
      '- Atue como um consultor especialista que elimina dúvidas e facilita a decisão, sem soar como telemarketing agressivo.\n' +
      '- Nunca pressione artificialmente: a prioridade é ajudar o cliente a decidir com naturalidade.',
    closingConsultative:
      'Você é um consultor comercial consultivo: acompanha e facilita a decisão do cliente.\n' +
      '- Quando a dúvida principal for resolvida, evite perguntas abertas passivas como "Em que mais posso ajudar?"; prefira fechar com uma sugestão concreta e útil.\n' +
      '- Proponha o próximo passo como um consultor, sem empurrar: ofereça uma opção concreta (ex.: "Posso deixar seu pedido preparado se quiser", "Deixo seu pedido pronto e coordenamos a entrega?").\n' +
      '- Se o cliente ainda estiver em fase de investigação, responda às dúvidas e aguarde um sinal de intenção de compra antes de fechar.\n' +
      '- Não repita o mesmo gancho em mensagens consecutivas: varie a redação ou aguarde o momento natural.\n' +
      '- Nunca pressione artificialmente: a decisão final é do cliente.',
    closingBalanced:
      'Você é um consultor comercial equilibrado: guia o cliente em direção à decisão com naturalidade.\n' +
      '- A partir do segundo turno (ou quando a dúvida principal for resolvida), evite perguntas abertas passivas como "Em que mais posso ajudar?"; feche com um gancho comercial fluido ou uma pergunta de controle que facilite o próximo passo (ex.: "Agendamos seu pedido?", "Deixo seu pedido pronto? Confirma seus dados e a equipe coordena a entrega.").\n' +
      '- Se o cliente continuar fazendo perguntas (fase de investigação), responda e SEGURE o fechamento: não peça dados pessoais nem feche até haver um sinal de intenção de compra.\n' +
      '- Não repita o mesmo gancho nem a mesma pergunta em mensagens consecutivas: varie a redação ou feche apenas quando for natural.\n' +
      '- Atue como um consultor especialista que elimina dúvidas, sem soar como telemarketing agressivo.\n' +
      '- Nunca pressione artificialmente: a prioridade é ajudar o cliente a decidir.',
    deliveryPromiseRule:
      'NUNCA prometa datas, prazos nem horários de entrega que não estejam no seu conhecimento. Se o negócio tiver dias de entrega carregados, cite-os como estão. Se não tiver, diga que a equipe coordena a entrega e confirma pelo WhatsApp, sem comprometer datas.',
    rejectionPivotRule:
      'SE O CLIENTE RECUSAR OU MUDAR DE ASSUNTO:\n' +
      '- Se o cliente recusar informalmente ("não", "não, obrigado", "melhor não", "agora não", "já ia saindo") ou desviar a conversa para outro assunto, aceite com naturalidade, responda ao que ele pediu e NÃO repita a pergunta de confirmação nem o gancho de fechamento.\n' +
      '- Uma recusa clara encerra a tentativa de fechamento: não insista, não pergunte a mesma coisa de novo e não pressione. Continue disponível e siga a conversa.\n' +
      '- Se o cliente apenas mudar de assunto sem recusar, responda à nova pergunta com naturalidade; você pode retomar o fechamento mais adiante, uma única vez, sem repetir o mesmo texto.',
    salesClosingControl: 'Controle de Fechamento',
    closingMaxAttempts:
      'Máximo 1 tentativa de fechamento por conversa. Se foi recusado, NÃO tente novamente.',
    closingDeclineStop:
      'Se o cliente diz "não", "não obrigado", "não quero", "mais não", "melhor não" ou qualquer variação de recusa, PARE imediatamente. NÃO volte ao assunto de compra.',
    closingTopicShift:
      'Se o cliente mudar de assunto (pergunta outra coisa), responda a pergunta e NÃO volte ao assunto de compra, a menos que o cliente traga o assunto primeiro.',
    salesAskAddress:
      '- Peça o endereço de entrega ao confirmar o pedido. Formato: "Rua e número, Bairro, Cidade, Estado". Não invente endereços.',
    salesAskPhone:
      '- Peça o número de telefone ao confirmar o pedido. Apenas dígitos e +. Não invente números.',
    salesCancellationAllowed:
      'O cliente pode cancelar pedidos dentro de {hours} horas após a compra. Se solicitar cancelamento dentro da janela, confirme uma vez. Se estiver fora da janela, indique que escalará para suporte humano.',
    salesCancellationDenied:
      'Cancelamentos não estão disponíveis pelo chat. Se o cliente solicitar cancelamento, indique que deve entrar em contato com o suporte ao cliente diretamente.',
  },
  tour: {
    dialogLabel: 'Tutorial',
    closeLabel: 'Fechar tutorial',
    tutorialButton: 'Tutorial',
    offerTitle: 'Quer ver como funciona?',
    offerDesc: 'A MIA pode mostrar o que cada botão desta página faz.',
    offerStart: 'Ver tutorial',
    offerDismiss: 'Agora não',
    skip: 'Pular',
    back: 'Voltar',
    next: 'Próximo',
    finish: 'Concluir',
    step: (current: number, total: number) => `Etapa ${current} de ${total}`,
    shell: {
      nav: {
        title: 'Sua navegação',
        desc: 'Navegue pela MIA daqui: Hoje, Aprenda, Cresça e Configurações agrupam todas as seções.',
      },
      module: {
        title: 'Módulo ativo',
        desc: 'Altere o módulo em que a MIA trabalha: Vendas, Inventário ou Logística. Cada um colore a interface e suas seções.',
      },
      theme: {
        title: 'Modo claro / escuro',
        desc: 'Alterne entre o tema claro e o escuro para maior conforto visual.',
      },
      language: {
        title: 'Idioma',
        desc: 'Escolha o idioma da MIA: espanhol, inglês, português ou japonês.',
      },
      signals: {
        title: 'Sinais da MIA',
        desc: 'Os sinais que a MIA detecta (vendas, acompanhamentos, dados interessantes) aparecem aqui. Abra para revisar sua caixa de entrada.',
      },
      mia: {
        title: 'Presença da MIA',
        desc: 'Mostra o estado da MIA: ativa, aprendendo ou descansando. Clique para alterar ou ir para Saúde.',
      },
    },
    home: {
      vitals: {
        title: 'Métricas do dia',
        desc: 'O pulso do seu negócio nas últimas 24 horas: conversas ativas, novos clientes, mensagens gerenciadas e a preparação da MIA.',
      },
      modules: {
        title: 'Zonas da MIA',
        desc: 'Atalhos para os módulos principais: Memória, Pensamento e Laboratório. Cada um mostra um resumo do que a MIA está fazendo.',
      },
      report: {
        title: 'Relatório semanal',
        desc: 'Toda segunda-feira a MIA monta um resumo da semana: conversas, aprendizados e recomendações para crescer.',
      },
    },
    conversations: {
      search: {
        title: 'Buscar conversas',
        desc: 'Encontre uma conversa pelo nome, telefone ou e-mail do cliente.',
      },
      status: {
        title: 'Filtrar por status',
        desc: 'Filtre as conversas pelo status: ativas, em espera, concluídas, abandonadas ou arquivadas.',
      },
      assistant: {
        title: 'Filtrar por assistente',
        desc: 'Se você tiver vários assistentes, escolha de qual deseja ver as conversas.',
      },
      list: {
        title: 'Lista de conversas',
        desc: 'Cada conversa mostra o cliente, a última atividade e um resumo. Expanda uma para ver memória e notas.',
      },
    },
    knowledge: {
      tabKnowledge: {
        title: 'Base de Conhecimento',
        desc: 'Fatos e informações do negócio que a MIA deve conhecer para atender bem seus clientes.',
      },
      tabMedia: {
        title: 'Biblioteca de Mídia',
        desc: 'Imagens e depoimentos que a MIA envia conforme o contexto da conversa.',
      },
      tabInstructions: {
        title: 'Instruções de IA',
        desc: 'Regras de comportamento e personalidade da MIA: como ela responde e quais prioridades segue.',
      },
      tabFiles: {
        title: 'Arquivos',
        desc: 'Ensine a MIA com seus documentos. Envie um arquivo e ela aprende automaticamente.',
      },
    },
    catalog: {
      actions: {
        title: 'Ações do catálogo',
        desc: 'Mídias gerais abre a biblioteca; Importar carrega produtos de uma fonte; Novo produto adiciona um manualmente com SKU e preço.',
      },
      grid: {
        title: 'Seus produtos',
        desc: 'Cada cartão é um produto. Clique em um para gerenciar suas mídias, editar ou excluir.',
      },
    },
    studio: {
      analyze: {
        title: 'Executar Análise',
        desc: 'Analisa a base de conhecimento da MIA e calcula o quão preparada ela está para atender seus clientes.',
      },
      score: {
        title: 'Pontuação de prontidão',
        desc: 'A pontuação geral de prontidão da MIA, dividida em completude, consistência e prontidão.',
      },
      stats: {
        title: 'Resultados da análise',
        desc: 'Um resumo rápido da análise: problemas detectados e sugestões aprovadas ou pendentes.',
      },
      suggestions: {
        title: 'Sugestões da MIA',
        desc: 'A MIA propõe melhorias concretas de conhecimento. Filtre, revise e aprove as que servir.',
      },
    },
    delivery: {
      routes: {
        title: 'Rotas',
        desc: 'Crie e gerencie rotas de delivery. Atribua pedidos pendentes a um motoboy e uma data.',
      },
      drivers: {
        title: 'Motoboys',
        desc: 'Adicione pessoal de delivery, gere links de acesso e gerencie o status deles.',
      },
      orders: {
        title: 'Pedidos',
        desc: 'Visualize pedidos por status: sem atribuir, atribuídos, entregues, com incidência ou cancelados.',
      },
      closures: {
        title: 'Fechamentos',
        desc: 'Feche o dia de delivery: conte o dinheiro, concilie o esperado vs. arrecadado e adicione notas.',
      },
    },
  },
}
