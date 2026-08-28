import type { Dict } from './es'

export const en: Dict = {
  common: {
    appName: 'MIA',
    back: 'Back',
    save: 'Save',
    cancel: 'Cancel',
    reset: 'Reset',
    loading: 'Loading…',
    error: 'Something went wrong',
  },
  nav: {
    today: 'Today',
    commandCenter: 'Command Center',
    commandCenterQuestion: 'how is my business doing?',
    relations: 'Relations',
    relationsQuestion: 'what is happening with my customers?',
    learn: 'Learn',
    memory: 'Memory',
    memoryQuestion: 'what did MIA discover?',
    thinking: 'Thinking',
    thinkingQuestion: 'what is it analyzing?',
    catalog: 'Catalog',
    catalogQuestion: 'products and their media',
    grow: 'Grow',
    lab: 'Lab',
    labQuestion: 'how can it improve?',
    delivery: 'Delivery',
    deliveryQuestion: 'drivers and deliveries',
    inventory: 'Inventory',
    inventoryQuestion: 'stock and restocking',
    analytics: 'Analytics',
    analyticsQuestion: 'business metrics and insights',
    settings: 'Settings',
    salesSettings: 'Sales Settings',
    salesSettingsQuestion: 'how MIA confirms orders and cancellations',
    adjustments: 'Adjustments',
    connections: 'Connections',
    connectionsTitle: 'channels and integrations',
    advanced: 'Advanced',
    council: 'Council',
    councilTitle: 'agents, permissions and integrations',
    health: 'Health',
    healthTitle: 'system status and automatic checks',
    accessibility: 'Accessibility',
    accessibilityTitle: 'accessibility, ergonomics and visual comfort',
    platformAdmin: 'Platform',
    platformAdminTitle: 'infrastructure control panel',
    logout: 'Log Out',
    logoutTitle: 'log out and exit',
  },
  topbar: {
    toggleLight: 'Switch to light mode',
    toggleDark: 'Switch to dark mode',
    language: 'Language',
  },
  dashboard: {
    welcome: 'Welcome',
    hi: 'Hi',
    greetingSubtitleEmpty:
      'Tell me about your business so I can start supporting you.',
    letsStart: "Let's get started!",
    tellAboutBusiness:
      'Tell me about your business so I can start working with you.',
    tellMia: 'Tell MIA about my business',
    createAssistantTitle: 'Create your first assistant',
    createAssistantSubtitle:
      "Let's set up MIA so it can start getting to know your customers.",
    createMia: 'Create MIA',
    activeConversations: 'Active conversations',
    heartOfMia: "MIA's heart beating for your business",
    last24h: 'In the last 24 hours',
    newCustomers: 'New customers',
    peopleMiaMeets: 'People MIA is getting to know',
    arrivedToday: 'Arrived today',
    messagesHandled: 'Messages handled',
    conversationsCared: 'Conversations MIA has taken care of for you',
    today: 'Today',
    readiness: 'Readiness',
    howReadyMia: 'How ready MIA is to serve',
    overallScore: 'Overall support score',
    explore: 'Explore what MIA is doing for you',
    memoryTitle: 'Memory',
    memoryDescription:
      'Everything MIA has learned about your business and customers',
    thinkingTitle: 'Thinking',
    thinkingDescription:
      'Signals, ideas and strategies MIA is analyzing for you',
    labTitle: 'Lab',
    labDescription: 'Train MIA with simulations to improve every day',
  },
  weeklyReport: {
    title: 'My weekly report',
    noReport: "I don't have a weekly report yet.",
    autoMonday: 'Reports are generated automatically every Monday.',
    generate: 'Generate my first report',
    generating: 'Generating my weekly report…',
    generateFailed: 'Could not generate the report.',
    conversations: 'conversations',
    newFacts: 'new things',
    products: 'products',
    preparation: 'preparation',
    recommendations: 'Recommendations',
  },
  sales: {
    title: 'Sales & Conversion',
    todaySales: "Today's sales",
    todayRevenue: "Today's revenue",
    weekSales: 'Sales this week',
    conversion: 'Conversion',
    topProducts: 'Best-selling products',
  },
  settings: {
    title: 'Sales Settings',
    subtitle: 'Manage how MIA confirms orders and handles cancellations',
    orderSection: 'Order',
    askAddress: 'Ask for shipping address',
    askPhone: 'Ask for phone number',
    confirmationSection: 'Confirmation',
    confirmationMessage: 'Confirmation message',
    cancellationSection: 'Cancellation',
    allowCancellation: 'Allow cancellation from chat',
    cancellationWindow: 'Cancellation window (hours)',
    cancellationMessage: 'Cancellation message',
    variables: 'Available variables',
    preview: 'Preview',
    save: 'Save settings',
    saved: 'Settings saved',
    error: 'Error saving settings',
  },
  signals: {
    calm: 'MIA is calm',
    observing: 'MIA found something interesting',
    attention: 'MIA needs your attention',
    decision: 'MIA needs your decision',
  },
  moduleStatus: {
    noNews: 'No news',
    newToday: (count: number) => `${count} new today`,
    analyzing: 'Analyzing',
    hypotheses: (count: number) => `${count} hypotheses`,
    noSimulations: 'No simulations',
    score: (value: string) => `Score ${value}`,
  },
  auth: {
    loginTitle: 'Sign in',
    signupTitle: 'Create account',
  },
  accessibility: {
    title: 'Accessibility and Ergonomics',
    subtitle:
      'Adjust how MIA looks and feels to reduce eye strain. Your preferences are saved to your profile and applied on all devices.',
    layout: 'Layout',
    layoutDescription:
      'Change the position of the sidebar to adapt your workspace.',
    mirrorMode: 'Mirror mode',
    mirrorModeLabel: 'Sidebar on the right',
    opticalComfort: 'Optical comfort',
    opticalComfortDescription:
      'Reduce contrast and eye strain by removing pure whites and blacks.',
    opticalMode: 'Antifatigue optical mode',
    opticalModeLabel: 'Soft palette and anti-aliasing',
    typography: 'Typography',
    typographyDescription:
      'Select the font weight to make reading easier.',
    fontWeight: 'Font weight',
    fontWeightNormal: 'Normal',
    fontWeightMedium: 'Medium',
    fontWeightBold: 'Bold',
    colorTemperature: 'Color temperature',
    colorTemperatureDescription:
      'Apply a warm or cool filter to the entire interface.',
    color: 'Color',
    colorNeutral: 'Neutral',
    colorWarm: 'Warm',
    colorCool: 'Cool',
    resetTitle: 'Reset preferences',
    resetDescription: 'Return to the default layout and palette.',
  },
  language: {
    title: 'Language',
    subtitle: 'Select the interface language.',
  },
  ai: {
    personalityWarmClose: 'warm and close',
    personalityDistant: 'professional and distant',
    personalityFormal: 'formal',
    personalityCasual: 'casual',
    personalityHumorous: 'with a good sense of humor',
    personalitySerious: 'serious',
    personalityProactive: 'proactive in sales',
    personalityConsultative: 'consultative, not aggressive',
    personalityBalanced: 'balanced',
    noProducts: 'There are no registered products yet.',
    noPrice: 'no price defined',
    benefits: 'Benefits',
    notSpecified: 'not specified',
    faq: 'Frequently asked questions',
    restrictions: 'Restrictions',
    noRules: 'There are no sales rules defined yet.',
    ruleTag: 'RULE',
    priority: 'PRIORITY',
    imageAvailable:
      'Send the image associated with this knowledge when the customer brings up this topic. It is sent automatically the first time in the conversation; you only need to mention in your reply that you are sharing an image about it.',
    knowledgeQuestion: 'Question',
    knowledgeAnswer: 'Answer',
    reason: 'Reason',
    finalDecision: 'FINAL DECISION',
    lessonRule: 'rule',
    lessonInstruction: 'instruction',
    lessonKnowledge: 'knowledge',
    removedDiscarded: '(removed/discarded)',
    yourObjective: 'Your Objective',
    objectiveText:
      'Help customers find what they need while respecting business rules. Sell naturally, without artificial pressure.',
    yourPersonality: 'Your Personality',
    personalityStyle: 'Your style is',
    communicationStyle: 'Communication Style',
    communicationStyleText: 'You manage a style',
    fundamentalRules: 'Fundamental Rules',
    neverInvent:
      'NEVER invent information, prices, features, or products that are not explicitly registered in your knowledge context or catalog.',
    offTopicBridge:
      'If a customer asks about topics unrelated to the business (such as general trivia, science, politics, or unrelated matters), do not provide external information: use it kindly as a bridge to steer the conversation back to the products or solutions this business offers.',
    ifUnsure:
      'If you do not know something specific about the business or an exact detail is not available in your sources, answer honestly with the assigned guideline (e.g., "Let me check that with the team") and hold firm to your commercial role.',
    knowledgeBoundary:
      'Your commercial knowledge is delimited exclusively by the catalog, the sales rules, and the documentation provided by this tenant.',
    responseFormat: 'Response Format',
    responseFormatText:
      'Keep a warm, professional tone focused on the customer\u0027s benefit.',
    recommendationFormat:
      'When you recommend an item, mention its name, its value, and highlight how it solves their specific need using catalog data.',
    askCity:
      'Ask for the city ONLY when the customer requests shipping/delivery or shows purchase intent, and the city has not been mentioned yet. If the customer is in the research phase (price, usage, benefits, doubts), do NOT ask for the city or any personal data: answer first. If the city is already known, do not ask again. NEVER promise delivery dates, deadlines, or days that are not in your knowledge.',
    noDiscounts:
      'Do not mention discounts unless the customer asks or they are in the rules.',
    humanHandoff:
      'Human handoff when the negotiation requires it.',
    conflictResolution: 'Conflict Resolution',
    conflictIntro:
      'If you find conflicting information between different sources, apply this authority order:',
    immutableDecisions:
      'The IMMUTABLE DECISIONS [IMMUTABLE] of the business always prevail over any other source.',
    manualInstructions:
      'The MANUAL INSTRUCTIONS [MANUAL] of the business owner prevail over rules and knowledge.',
    higherPriorityRules:
      'SALES RULES [RULE] with higher priority prevail over lower priority ones.',
    reviewedKnowledge:
      'REVIEWED KNOWLEDGE [CORRECTION] prevails over imported knowledge [DOCUMENT].',
    recentKnowledge:
      'RECENT KNOWLEDGE prevails over old knowledge (creation date).',
    statisticalPatterns:
      'Statistical PATTERNS [PATTERN] have the least authority.',
    conflictPersists:
      'If after applying these rules the conflict persists:',
    priceConflict:
      'If it affects prices: Ask the customer which source they consulted.',
    businessRuleConflict:
      'If it affects business rules: Escalate to a human advisor.',
    harmlessConflict:
      'If it is a harmless contradiction: Use the most recent information.',
    autonomy: 'Autonomy',
    canDo: 'You can:',
    explainProducts: 'explain products',
    resolveDoubts: 'resolve doubts',
    recommendOptions: 'recommend options',
    answerFaqs: 'answer frequently asked questions',
    cannotDo: 'You cannot:',
    changePrices: 'change prices',
    promiseExceptions: 'promise exceptions',
    inventPromotions: 'invent promotions',
    confirmOrders: 'confirm orders without validating rules',
    giveUnverified: 'give information that is not in your knowledge',
    businessInfo: 'Business Information',
    noBusinessInfo:
      'Business information has not been configured yet.',
    targetCustomers: 'Target customers',
    differentiators: 'What makes us different',
    products: 'Products',
    salesRules: 'Sales Rules',
    additionalInstructions: 'Additional Instructions',
    additionalKnowledge: 'Additional Knowledge',
    businessMemory: 'Internal Business Memory',
    customerMemory: 'Customer Memory',
    whatIveLearned: 'What I have learned from you',
    lastCorrections: 'Latest corrections you taught me:',
    languageMatching:
      'Always respond in the same language the customer uses. If the customer writes in English, respond in English. If they write in Spanish, respond in Spanish. If they write in Portuguese, respond in Portuguese. If they mix languages in a single message, respond in the predominant language of the message. You do not need to ask which language they prefer.',
    finalInstruction: 'Final Instruction',
    finalInstructionText:
      'BEFORE RESPONDING: Actively review whether there is conflicting information between the previous sections. If you find contradictions, apply the authority order from Conflict Resolution. Do not mix incompatible rules.',
    toneNote:
      'The brand has defined its tone as. This tone is the general brand guide. If there is a conflict with your personal style, prioritize the assistant personality for direct interaction, but keep the brand tone as the general framework.',
    whatsappTone:
      'WHATSAPP CHANNEL:\n' +
      '- Reply in 2-3 lines maximum, with a warm and empathetic tone.\n' +
      '- Use the customer\'s name when you know it.\n' +
      '- Validate the customer\'s doubt or skepticism before replying (e.g. "I understand you want to be sure").\n' +
      '- Do not use bold, long lists, or excessive emojis; formatting shows as plain text.',
    waOrderCapture:
      'WHATSAPP ORDER CAPTURE:\n' +
      '- When the customer shows purchase intent, capture name, phone, address, and product naturally: ask ONE data point at a time, woven into the conversation. No interrogations or lists ("I need your name, your phone, your address...").\n' +
      '- If the customer already sent all their data (name, address, city, product), do NOT ask for anything else: repeat it in 2-3 lines and ask for explicit confirmation ("Shall I confirm your order? Product X, for..., delivery to..."). Do not treat the order as confirmed until the customer says yes.\n' +
      '- NEVER say "your order is confirmed", "done" or "we will proceed" without the customer\'s explicit "yes": use "Shall I confirm your order?" and wait for their reply.\n' +
      '- ADDRESS: capture it in ONE line with the format "Street and number, Col. <neighborhood>, <city>, <state>" (add the ZIP if the customer provides it). If the customer mixes data (e.g. the neighborhood together with the street), do NOT guess which is which: ask explicitly. Before marking the order as ready, repeat the full captured address and confirm it.\n' +
      '- Validate the order against business rules BEFORE confirming (prices, restrictions, shipping zones). If you cannot validate something, escalate it.\n' +
      '- DELIVERY: mention delivery days or times ONLY if they appear in your knowledge. If the owner loaded them, use them as-is. If they are not there, do not invent them: say something credible like "we will confirm delivery days when we coordinate your order".\n' +
      '- Never promise "it arrives tomorrow", "ready today", or any timeframe not written in your knowledge.\n' +
      '- Once the order is confirmed, close the trust loop by telling the customer what is next: "All set! We will confirm delivery by WhatsApp." Do not give dates you do not know.\n' +
      '- Do not invent discounts, promotions, or exceptions to close the sale.',
    intentTagDirective:
      'INTENT TAG (INTENT_TAG):\n' +
      '- If the system indicates an intent tag, use it to reply concisely and focused.\n' +
      '- If an interactive menu with buttons or a list is shown, do NOT repeat it in your reply: the customer sees it on screen. Only reply the content briefly and naturally.',
    waClosingHook:
      'Shall I get your order ready? Confirm your details and the team will coordinate delivery.',
    youAre: 'You are',
    salesAssistantOf: 'the sales assistant of',
    salesPurpose:
      'Your main purpose is to guide the customer, resolve their commercial questions strictly based on the inventory and the rules provided, and always steer the conversation toward the sale or recommendation of the business\u0027s products.',
    closingPolicy: 'Sales Closing Policy',
    closingProactive:
      'You are a proactive sales advisor: you guide the customer toward the decision.\n' +
      '- From the second turn (or once the main question is resolved), do NOT close with passive open questions such as "How else can I help you?" or "Do you have any other questions?".\n' +
      '- Close every informative reply with a smooth commercial hook or a control question that moves to the next step (e.g. "Shall I schedule your order?", "Shall I get your order ready? Confirm your details and the team will coordinate delivery.").\n' +
      '- If the customer keeps asking questions (research phase), answer and HOLD the close: do not ask for personal data or close until there is a purchase-intent signal (price, shipping, payment, or asking to buy).\n' +
      '- Do not repeat the same hook or question in consecutive messages: vary the wording or close only when it feels natural.\n' +
      '- Act as an expert advisor who removes doubts and makes the decision easier, without sounding like aggressive telemarketing.\n' +
      '- Never apply artificial pressure: the priority is to help the customer decide naturally.',
    closingConsultative:
      'You are a consultative sales advisor: you accompany and make the customer\u2019s decision easier.\n' +
      '- Once the main question is resolved, avoid passive open questions like "How else can I help you?"; prefer to close with a concrete, useful suggestion.\n' +
      '- Propose the next step as an advisor, without pushing: offer a concrete option (e.g. "I can prepare your order if you want", "Shall I get your order ready and coordinate delivery?").\n' +
      '- If the customer is still in the research phase, answer their questions and wait for a purchase-intent signal before closing.\n' +
      '- Do not repeat the same hook in consecutive messages: vary the wording or wait for the natural moment.\n' +
      '- Never apply artificial pressure: the final decision belongs to the customer.',
    closingBalanced:
      'You are a balanced sales advisor: you guide the customer toward the decision naturally.\n' +
      '- From the second turn (or once the main question is resolved), avoid passive open questions such as "How else can I help you?"; close with a smooth commercial hook or a control question that makes the next step easier (e.g. "Shall I schedule your order?", "Shall I get your order ready? Confirm your details and the team will coordinate delivery.").\n' +
      '- If the customer keeps asking questions (research phase), answer and HOLD the close: do not ask for personal data or close until there is a purchase-intent signal.\n' +
      '- Do not repeat the same hook or question in consecutive messages: vary the wording or close only when it feels natural.\n' +
      '- Act as an expert advisor who removes doubts, without sounding like aggressive telemarketing.\n' +
      '- Never apply artificial pressure: the priority is to help the customer decide.',
    deliveryPromiseRule:
      'NEVER promise delivery dates, deadlines, or times that are not in your knowledge. If the business has delivery days loaded, cite them as-is. If not, say the team coordinates delivery and confirms by WhatsApp, without committing to dates.',
    rejectionPivotRule:
      'IF THE CUSTOMER DECLINES OR CHANGES SUBJECT:\n' +
      '- If the customer declines informally ("no", "no thanks", "better not", "not now", "I was leaving") or diverts the conversation to another topic, accept it naturally, address what they asked, and do NOT repeat the confirmation question or the closing hook.\n' +
      '- A clear decline ends the closing attempt: do not insist, do not re-ask the same thing, and do not pressure. Stay available and follow the conversation.\n' +
      '- If the customer only changes subject without declining, answer their new question naturally; you may return to the close later, once, without repeating the same wording.',
    salesClosingControl: 'Closing Control',
    closingMaxAttempts:
      'Maximum 1 closing attempt per conversation. If declined, do NOT retry.',
    closingDeclineStop:
      'If the customer says "no", "no thanks", "I don\'t want it", "not anymore", "better not" or any decline variation, STOP immediately. Do NOT return to the purchase topic.',
    closingTopicShift:
      'If the customer changes the subject (asks about something else), answer the question and do NOT return to the purchase topic unless the customer brings it up first.',
    salesAskAddress:
      '- Ask for the shipping address when confirming the order. Format: "Street and number, Neighborhood, City, State". Do not invent addresses.',
    salesAskPhone:
      '- Ask for the phone number when confirming the order. Digits and + only. Do not invent numbers.',
    salesCancellationAllowed:
      'The customer can cancel orders within {hours} hours of purchase. If they request cancellation within the window, confirm once. If outside the window, indicate you will escalate to human support.',
    salesCancellationDenied:
      'Cancellations are not available via chat. If the customer requests cancellation, indicate they should contact customer support directly.',
  },
  tour: {
    dialogLabel: 'Tutorial',
    closeLabel: 'Close tutorial',
    tutorialButton: 'Tutorial',
    offerTitle: 'Want to see how it works?',
    offerDesc: 'MIA can show you what each button on this page does.',
    offerStart: 'View tutorial',
    offerDismiss: 'Not now',
    skip: 'Skip',
    back: 'Back',
    next: 'Next',
    finish: 'Finish',
    step: (current: number, total: number) => `Step ${current} of ${total}`,
    shell: {
      nav: {
        title: 'Your navigation',
        desc: 'Move around MIA from here: Today, Learn, Grow and Settings group every section.',
      },
      module: {
        title: 'Active module',
        desc: 'Switch the module MIA works on: Sales, Inventory or Logistics. Each one colors the interface and its sections.',
      },
      theme: {
        title: 'Light / dark mode',
        desc: 'Toggle between light and dark themes for visual comfort.',
      },
      language: {
        title: 'Language',
        desc: "Choose MIA's language: Spanish, English, Portuguese or Japanese.",
      },
      signals: {
        title: 'MIA signals',
        desc: 'The signals MIA detects (sales, follow-ups, interesting data) land here. Open it to review your inbox.',
      },
      mia: {
        title: 'MIA presence',
        desc: "Shows MIA's state: active, learning or resting. Click it to change it or go to Health.",
      },
    },
    home: {
      vitals: {
        title: "Today's metrics",
        desc: "Your business pulse in the last 24 hours: active conversations, new customers, handled messages and MIA's readiness.",
      },
      modules: {
        title: 'MIA zones',
        desc: 'Shortcuts to the main modules: Memory, Thinking and Lab. Each shows a summary of what MIA is doing.',
      },
      report: {
        title: 'Weekly report',
        desc: 'Every Monday MIA puts together a weekly summary: conversations, learnings and recommendations to grow.',
      },
    },
    conversations: {
      search: {
        title: 'Search conversations',
        desc: "Find a conversation by the customer's name, phone or email.",
      },
      status: {
        title: 'Filter by status',
        desc: 'Filter conversations by their state: active, waiting, completed, abandoned or archived.',
      },
      assistant: {
        title: 'Filter by assistant',
        desc: "If you have several assistants, choose which one's conversations to see.",
      },
      list: {
        title: 'Conversation list',
        desc: 'Each conversation shows the customer, last activity and a summary. Expand one to see memory and notes.',
      },
    },
    knowledge: {
      tabKnowledge: {
        title: 'Knowledge Base',
        desc: 'Facts and business info MIA must know to serve your customers well.',
      },
      tabMedia: {
        title: 'Media Library',
        desc: 'Images and testimonials MIA sends based on conversation context.',
      },
      tabInstructions: {
        title: 'AI Instructions',
        desc: "MIA's behavior and personality rules: how she responds and what priorities she follows.",
      },
      tabFiles: {
        title: 'Files',
        desc: 'Teach MIA with your documents. Upload a file and she learns from it automatically.',
      },
    },
    catalog: {
      actions: {
        title: 'Catalog actions',
        desc: 'General media opens the media library; Import loads products from a source; New product adds one by hand with its SKU and price.',
      },
      grid: {
        title: 'Your products',
        desc: 'Each card is a product. Click one to manage its media, edit or delete it.',
      },
    },
    studio: {
      analyze: {
        title: 'Run Analysis',
        desc: "Analyzes MIA's knowledge base and scores how ready she is to serve your customers.",
      },
      score: {
        title: 'Readiness score',
        desc: "MIA's overall readiness score, broken down into completeness, consistency, and readiness.",
      },
      stats: {
        title: 'Analysis results',
        desc: 'A quick summary of the analysis: detected issues and approved or pending suggestions.',
      },
      suggestions: {
        title: 'MIA suggestions',
        desc: 'MIA proposes concrete knowledge improvements. Filter, review, and approve the ones you like.',
      },
    },
    delivery: {
      routes: {
        title: 'Routes',
        desc: 'Create and manage delivery routes. Assign pending orders to a driver and a date.',
      },
      drivers: {
        title: 'Drivers',
        desc: 'Add delivery personnel, generate access links and manage their status.',
      },
      orders: {
        title: 'Orders',
        desc: 'View orders by status: pending, assigned, delivered, with incidence or cancelled.',
      },
      closures: {
        title: 'Closures',
        desc: 'Close a delivery day: count cash, reconcile expected vs. collected and add notes.',
      },
    },
  },
}
