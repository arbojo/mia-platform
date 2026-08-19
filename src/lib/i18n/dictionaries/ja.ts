import type { Dict } from './es'

export const ja: Dict = {
  common: {
    appName: 'MIA',
    back: '戻る',
    save: '保存',
    cancel: 'キャンセル',
    reset: 'リセット',
    loading: '読み込み中…',
    error: 'エラーが発生しました',
  },
  nav: {
    today: '今日',
    commandCenter: 'コマンドセンター',
    commandCenterQuestion: 'ビジネスの調子は？',
    relations: 'リレーション',
    relationsQuestion: '顧客の状況は？',
    learn: '学ぶ',
    memory: 'メモリー',
    memoryQuestion: 'MIAは何を発見した？',
    thinking: '思考',
    thinkingQuestion: '何を分析している？',
    catalog: 'カタログ',
    catalogQuestion: '商品とそのメディア',
    grow: '成長',
    lab: 'ラボ',
    labQuestion: 'どう改善できる？',
    delivery: 'デリバリー',
    deliveryQuestion: '配達員と配達',
    inventory: '在庫',
    inventoryQuestion: '在庫と補充',
    settings: '設定',
    salesSettings: '販売設定',
    salesSettingsQuestion: 'MIAが注文とキャンセルをどう確認するか',
    adjustments: '調整',
    connections: '接続',
    connectionsTitle: 'チャネルと統合',
    advanced: '詳細',
    council: 'カウンシル',
    councilTitle: 'エージェント、権限、統合',
    health: 'ヘルス',
    healthTitle: 'システム状態と自動チェック',
    accessibility: 'アクセシビリティ',
    accessibilityTitle: 'アクセシビリティ、エルゴノミクス、視覚的快適性',
  },
  topbar: {
    toggleLight: 'ライトモードに切り替え',
    toggleDark: 'ダークモードに切り替え',
    language: '言語',
  },
  dashboard: {
    welcome: 'ようこそ',
    hi: 'こんにちは',
    greetingSubtitleEmpty:
      'サポートを始めるために、ビジネスについて教えてください。',
    letsStart: '始めましょう！',
    tellAboutBusiness:
      '一緒に働き始めるために、ビジネスについて教えてください。',
    tellMia: 'MIAにビジネスについて伝える',
    createAssistantTitle: '最初のアシスタントを作成',
    createAssistantSubtitle:
      'MIAを設定して、顧客について学び始めましょう。',
    createMia: 'MIAを作成',
    activeConversations: 'アクティブな会話',
    heartOfMia: 'ビジネスのために鼓動するMIAの心',
    last24h: '過去24時間',
    newCustomers: '新規顧客',
    peopleMiaMeets: 'MIAが知り合っている人々',
    arrivedToday: '今日到着',
    messagesHandled: '処理したメッセージ',
    conversationsCared: 'MIAがあなたの代わりに担当した会話',
    today: '今日',
    readiness: '準備状況',
    howReadyMia: 'MIAが対応できる準備がどの程度整っているか',
    overallScore: '全体的なサポートスコア',
    explore: 'MIAがあなたのためにしていることを探索',
    memoryTitle: 'メモリー',
    memoryDescription: 'MIAがビジネスと顧客について学んだすべて',
    thinkingTitle: '思考',
    thinkingDescription: 'MIAが分析しているシグナル、アイデア、戦略',
    labTitle: 'ラボ',
    labDescription: 'シミュレーションでMIAを訓練し、毎日改善',
  },
  weeklyReport: {
    title: '私の週間レポート',
    noReport: '週間レポートはまだありません。',
    autoMonday: 'レポートは毎週月曜日に自動生成されます。',
    generate: '最初のレポートを生成',
    generating: '週間レポートを生成中…',
    generateFailed: 'レポートを生成できませんでした。',
    conversations: '会話',
    newFacts: '新しい学び',
    products: '商品',
    preparation: '準備',
    recommendations: 'おすすめ',
  },
  sales: {
    title: '売上とコンバージョン',
    todaySales: '今日の売上',
    todayRevenue: '今日の収益',
    weekSales: '今週の売上',
    conversion: 'コンバージョン',
    topProducts: 'ベストセラー商品',
  },
  settings: {
    title: '販売設定',
    subtitle: 'MIAが注文を確認し、キャンセルを処理する方法を管理',
    orderSection: '注文',
    askAddress: '配送先住所を寻ねる',
    askPhone: '電話番号を寻ねる',
    confirmationSection: '確認',
    confirmationMessage: '確認メッセージ',
    cancellationSection: 'キャンセル',
    allowCancellation: 'チャットからのキャンセルを許可',
    cancellationWindow: 'キャンセル猶予時間（時間）',
    cancellationMessage: 'キャンセルメッセージ',
    variables: '利用可能な変数',
    preview: 'プレビュー',
    save: '設定を保存',
    saved: '設定が保存されました',
    error: '設定の保存中にエラーが発生しました',
  },
  signals: {
    calm: 'MIAは落ち着いています',
    observing: 'MIAが興味深いものを発見しました',
    attention: 'MIAの注意が必要です',
    decision: 'MIAの決断が必要です',
  },
  moduleStatus: {
    noNews: '特に新しい情報はありません',
    newToday: (count: number) => `今日は${count}件`,
    analyzing: '分析中',
    hypotheses: (count: number) => `${count}件の仮説`,
    noSimulations: 'シミュレーションはありません',
    score: (value: string) => `スコア ${value}`,
  },
  auth: {
    loginTitle: 'ログイン',
    signupTitle: 'アカウント作成',
  },
  accessibility: {
    title: 'アクセシビリティとエルゴノミクス',
    subtitle:
      '目の疲れを軽減するために、MIAの見た目と操作感を調整します。設定はプロフィールに保存され、すべてのデバイスに適用されます。',
    layout: 'レイアウト',
    layoutDescription:
      '作業スペースに合わせてサイドバーの位置を変更します。',
    mirrorMode: 'ミラーモード',
    mirrorModeLabel: 'サイドバーを右側に',
    opticalComfort: '光学快適性',
    opticalComfortDescription:
      '純白と純黒を排除してコントラストと目の疲れを軽減します。',
    opticalMode: '疲労軽減光学モード',
    opticalModeLabel: 'ソフトなパレットとアンチエイリアス',
    typography: 'タイポグラフィ',
    typographyDescription:
      '読みやすくするためにフォントの太さを選択します。',
    fontWeight: 'フォントの太さ',
    fontWeightNormal: '標準',
    fontWeightMedium: '中',
    fontWeightBold: '太字',
    colorTemperature: '色温度',
    colorTemperatureDescription:
      'インターフェース全体に暖色または寒色フィルターを適用します。',
    color: '色',
    colorNeutral: 'ニュートラル',
    colorWarm: '暖色',
    colorCool: '寒色',
    resetTitle: '設定をリセット',
    resetDescription: 'デフォルトのレイアウトとパレットに戻します。',
  },
  language: {
    title: '言語',
    subtitle: 'インターフェースの言語を選択します。',
  },
  ai: {
    personalityWarmClose: '温かく親しみやすい',
    personalityDistant: 'プロフェッショナルで距離がある',
    personalityFormal: 'フォーマル',
    personalityCasual: 'カジュアル',
    personalityHumorous: 'ユーモアがある',
    personalitySerious: '真面目',
    personalityProactive: '販売に積極的',
    personalityConsultative: 'コンサルタティブ、攻撃的でない',
    personalityBalanced: 'バランスが取れた',
    noProducts: '登録された商品はまだありません。',
    noPrice: '価格未設定',
    benefits: 'メリット',
    notSpecified: '未指定',
    faq: 'よくある質問',
    restrictions: '制限事項',
    noRules: '販売ルールはまだ定義されていません。',
    ruleTag: 'ルール',
    priority: '優先度',
    imageAvailable:
      '顧客がこのテーマに触れたときに、このナレッジに関連付けられた画像を送信します。会話の最初に自動的に送信されます。回答では画像を共有していることを述べるだけで構いません。',
    knowledgeQuestion: '質問',
    knowledgeAnswer: '回答',
    reason: '理由',
    finalDecision: '最終決定',
    lessonRule: 'ルール',
    lessonInstruction: '指示',
    lessonKnowledge: 'ナレッジ',
    removedDiscarded: '（削除・破棄）',
    yourObjective: 'あなたの目的',
    objectiveText:
      'ビジネスのルールを尊重しながら、顧客が必要とするものを見つける手助けをします。人工的な圧力をかけず、自然に販売します。',
    yourPersonality: 'あなたの性格',
    personalityStyle: 'あなたのスタイルは',
    communicationStyle: 'コミュニケーションスタイル',
    communicationStyleText: 'あなたはスタイルを管理します',
    fundamentalRules: '基本ルール',
    neverInvent:
      'ナレッジのコンテキストやカタログに明示的に登録されていない情報・価格・特徴・商品を決して作り出さないこと。',
    offTopicBridge:
      '顧客が事業に関係のない話題（一般的な雑学、科学、政治、無関係な事柄など）を尋ねた場合、外部情報は提供せず、その話題をきっかけに会話をこの事業が提供する商品やソリューションへと丁寧に戻してください。',
    ifUnsure:
      '事業について具体的にわからないことや、正確なデータが情報源にない場合は、割り当てられたガイドライン（例：「チームに確認させてください」）に従って正直に答え、営業としての役割をしっかり守ってください。',
    knowledgeBoundary:
      'あなたの営業知識は、このテナントが提供するカタログ・販売ルール・ドキュメントのみに限定されます。',
    responseFormat: '応答形式',
    responseFormatText:
      '親しみやすくプロフェッショナルな、顧客の利益に焦点を当てたトーンを保ってください。',
    recommendationFormat:
      '商品を推薦するときは、その名前、価値を伝え、カタログのデータを使って顧客の具体的なニーズをどう解決するかを強調してください。',
    askCity:
      '顧客が配送・配達を求めたとき、または購入意図を示したとき、まだ都市が明かされていない場合にのみ都市を尋ねます。顧客が調査段階（価格・使い方・利点・疑問）にいる場合は、都市や個人データを尋ねず、まず回答します。都市がすでに分かっている場合は再度尋ねません。ナレッジにない納期・日数・配達日を決して約束しません。',
    noDiscounts:
      '顧客が尋ねない限り、またはルールにない限り、割引について言及しません。',
    humanHandoff:
      '交渉の必要があれば、担当者へ引き継ぎます。',
    conflictResolution: '矛盾の解決',
    conflictIntro:
      '異なる情報源の間に矛盾を見つけた場合は、この権限順序を適用します：',
    immutableDecisions:
      'ビジネスの不変の決定 [不変] は常に他のすべての情報源より優先されます。',
    manualInstructions:
      'オーナーの手動指示 [手動] はルールとナレッジより優先されます。',
    higherPriorityRules:
      '優先度の高い販売ルール [ルール] は低いものより優先されます。',
    reviewedKnowledge:
      'レビュー済みナレッジ [修正] はインポートされたナレッジ [文書] より優先されます。',
    recentKnowledge:
      '最近のナレッジは古いナレッジ（作成日）より優先されます。',
    statisticalPatterns:
      '統計パターン [パターン] は最も低い権限を持ちます。',
    conflictPersists:
      'これらのルールを適用しても矛盾が残る場合：',
    priceConflict: '価格に影響する場合：顧客にどの情報源を確認したか尋ねます。',
    businessRuleConflict:
      'ビジネスルールに影響する場合：人間のアドバイザーにエスカレーションします。',
    harmlessConflict:
      'リスクのない矛盾の場合：最も新しい情報を使用します。',
    autonomy: '自律性',
    canDo: 'できること：',
    explainProducts: '商品を説明する',
    resolveDoubts: '疑問を解決する',
    recommendOptions: '選択肢を推薦する',
    answerFaqs: 'よくある質問に答える',
    cannotDo: 'できないこと：',
    changePrices: '価格を変更する',
    promiseExceptions: '例外を約束する',
    inventPromotions: 'プロモーションを作り出す',
    confirmOrders: 'ルールを検証せずに注文を確定する',
    giveUnverified: 'ナレッジにない情報を提供する',
    businessInfo: 'ビジネス情報',
    noBusinessInfo: 'ビジネス情報はまだ設定されていません。',
    targetCustomers: 'ターゲット顧客',
    differentiators: '差別化ポイント',
    products: '商品',
    salesRules: '販売ルール',
    additionalInstructions: '追加の指示',
    additionalKnowledge: '追加のナレッジ',
    businessMemory: '内部ビジネスメモリー',
    customerMemory: '顧客メモリー',
    whatIveLearned: 'あなたから学んだこと',
    lastCorrections: '最近教えてもらった修正：',
    finalInstruction: '最終指示',
    finalInstructionText:
      '回答前：前のセクション間に矛盾する情報がないか積極的に確認します。矛盾を見つけた場合は、矛盾解決の権限順序を適用します。互換性のないルールを混在させないでください。',
    toneNote:
      'ブランドはトーンを次のように定義しています。このトーンはブランドの一般的なガイドです。あなたの個人的なスタイルと衝突する場合は、直接の対話ではアシスタントの性格を優先しますが、ブランドのトーンを一般的な枠組みとして維持します。',
    whatsappTone:
      'WhatsAppチャンネル：\n' +
      '- 最大2〜3行で回答し、温かく共感的な口調を心がけます。\n' +
      '- 顧客の名前を知っている場合は使用します。\n' +
      '- 回答する前に顧客の疑問や懐疑心を認めます（例：「確認したいお気持ちは理解できます」）。\n' +
      '- 太字、長いリスト、多用する絵文字は避けます。書式はプレーンテキストとして表示されます。',
    waOrderCapture:
      'WhatsApp注文キャプチャ：\n' +
      '- 顧客が購入意図を示したら、名前・電話番号・住所・商品を自然にキャプチャします。一度に1つのデータだけを会話の流れに組み込んで尋ねます。尋問や一覧（「お名前、お電話番号、ご住所が必要です…」）は禁止です。\n' +
      '- 顧客がすでにすべてのデータ（名前、住所、都市、商品）を送った場合は、それ以上尋ねず、2〜3行で繰り返して明示的な確認を求めます（「注文を確定しますか？商品X、お名前…、お届け先…」）。顧客が「はい」と言うまで注文を確定扱いにしません。\n' +
      '- 顧客の明示的な「はい」なしに「注文が確定しました」「完了」「進めます」とは決して言いません。「注文を確定しますか？」と尋ね、返答を待ちます。\n' +
      '- 住所：1行で「番地・号、<colonia>地区、<都市>、<州>」の形式でキャプチャします（顧客が郵便番号を教えたら付け加えます）。顧客がデータを混ぜて書いた場合（例：地区を番地と一緒に書く）、どれが何かを推測せず、明示的に尋ねます。注文を準備完了とする前に、キャプチャした完全な住所を繰り返して確認します。\n' +
      '- 確定前にビジネスのルール（価格、制限、配送エリア）に照らして注文を検証します。検証できないものがあればエスカレーションします。\n' +
      '- 配送：配達日や時間は、ナレッジに記載されている場合のみ言及します。オーナーが登録していればそのまま使用します。ない場合は作り出さず、「ご注文の調整時に配達日をお知らせします」のような信頼できる返答をします。\n' +
      '- 「明日届きます」「今日中に準備できます」など、ナレッジに書かれていない期限を決して約束しません。\n' +
      '- 注文が確定したら、「完了です！配達についてはWhatsAppでご連絡します」と次のステップを伝えて信頼のサイクルを閉じます。知らない日付は伝えません。\n' +
      '- 販売を成立させるために割引やプロモーション、例外を作り出しません。',
    intentTagDirective:
      '意図タグ（INTENT_TAG）：\n' +
      '- システムが意図タグを示している場合は、それを使って簡潔かつ焦点を絞って回答します。\n' +
      '- ボタンやリスト付きのインタラクティブメニューが表示される場合は、回答でそれを繰り返さないでください。顧客は画面上で確認できます。内容だけを簡潔に自然に答えます。',
    waClosingHook:
      'ご注文の準備をしておきましょうか？データを確認いただければ、チームが配送を調整します。',
    youAre: 'あなたは',
    salesAssistantOf: 'の営業アシスタントです',
    salesPurpose:
      'あなたの主な目的は、顧客を導き、提供された在庫とルールに厳密に基づいて営業上の質問を解決し、常に会話をこの事業の商品の販売や推薦へと導くことです。',
    closingPolicy: '営業クロージング方針',
    closingProactive:
      'あなたは積極的な営業アドバイザーです。顧客を決定へ導きます。\n' +
      '- 2ターン目以降（または主要な質問が解決した後）、「他に何かお手伝いできますか？」や「他にご質問はありますか？」のような受け身のオープンクエスチョンで会話を終えないでください。\n' +
      '- 情報提供の返答は、次のステップへ進む営業フックまたは確認の質問（例：「ご注文を手配しましょうか？」「ご注文の準備をしておきましょうか？データを確認いただければ、チームが配送を調整します。」）で自然に締めくくってください。\n' +
      '- 顧客が質問を続けている場合（調査段階）、回答し、クロージングを保留します。購入意図の兆候（価格・配送・支払い・購入の申し出）が現れるまで、個人データを求めたりクロージングしたりしません。\n' +
      '- 連続するメッセージで同じフックや同じ質問を繰り返さないでください。表現を変えるか、自然なタイミングでのみクロージングします。\n' +
      '- 疑念を解消し決定を容易にする専門のアドバイザーとして振る舞い、攻撃的なテレマーケティングのようにはならないでください。\n' +
      '- 人工的な圧力をかけないでください。優先すべきは、顧客が自然に決断できるようにすることです。',
    closingConsultative:
      'あなたはコンサルティング型の営業アドバイザーです。顧客の決定に寄り添い、容易にします。\n' +
      '- 主要な質問が解決した後、「他に何かお手伝いできますか？」のような受け身のオープンクエスチョンを避け、具体的で役立つ提案で締めくくってください。\n' +
      '- 押し付けずに、アドバイザーとして次のステップを提案します。具体的な選択肢を提示してください（例：「ご希望ならご注文を準備しておきますよ」「ご注文の準備をして、配送を調整しましょうか？」）。\n' +
      '- 顧客が調査段階にいる場合は、質問に答えて、クロージングの前に購入意図の兆候を待ちます。\n' +
      '- 連続するメッセージで同じフックを繰り返さないでください。表現を変えるか、自然なタイミングを待ちます。\n' +
      '- 人工的な圧力をかけないでください。最終的な決定は顧客のものです。',
    closingBalanced:
      'あなたはバランスの取れた営業アドバイザーです。顧客を自然に決定へ導きます。\n' +
      '- 2ターン目以降（または主要な質問が解決した後）、「他に何かお手伝いできますか？」のような受け身のオープンクエスチョンを避け、次のステップを容易にする営業フックまたは確認の質問（例：「ご注文を手配しましょうか？」「ご注文の準備をしておきましょうか？データを確認いただければ、チームが配送を調整します。」）で締めくくってください。\n' +
      '- 顧客が質問を続けている場合（調査段階）、回答し、クロージングを保留します。購入意図の兆候が現れるまで、個人データを求めたりクロージングしたりしません。\n' +
      '- 連続するメッセージで同じフックや同じ質問を繰り返さないでください。表現を変えるか、自然なタイミングでのみクロージングします。\n' +
      '- 疑念を解消する専門のアドバイザーとして振る舞い、攻撃的なテレマーケティングのようにはならないでください。\n' +
      '- 人工的な圧力をかけないでください。優先すべきは、顧客が決断できるようにすることです。',
    deliveryPromiseRule:
      'ナレッジにない納期・日数・配達時間を決して約束しません。ビジネスに配達日が登録されていればそのまま引用します。登録がない場合は、チームが配送を調整しWhatsAppで確認すると伝え、日付を約束しません。',
    rejectionPivotRule:
      '顧客が断る、または話題を変えた場合：\n' +
      '- 顧客が「いえ」「結構です」「やめておきます」「今はやめておきます」「帰るところでした」などと軽く断ったり、別の話題に話をそらしたりした場合は、自然に受け止め、依頼されたことに答え、確認の質問やクロージングのフックを繰り返さないでください。\n' +
      '- 明確な拒否でクロージングの試みは終了です。押しつけず、同じことを繰り返し尋ねず、プレッシャーをかけないでください。引き続き対応し、会話を続けます。\n' +
      '- 顧客が断らずに話題を変えただけの場合は、その新しい質問に自然に答え、後で一度だけ、同じ文言を繰り返さずにクロージングに戻っても構いません。',
    salesClosingControl: 'クロージング制御',
    closingMaxAttempts:
      '会話ごとにクロージングの試みは最大1回。断られた場合は再試行しないでください。',
    closingDeclineStop:
      '顧客が「いいえ」「結構です」「要りません」「もういいです」「やっぱりいい」など、拒否のバリエーションを示した場合は、即座にやめてください。購入の話題に戻らないでください。',
    closingTopicShift:
      '顧客が話題を変えた場合（別のことを聞いている場合）、その質問に答えて、顧客が先に購入の話題を持ち出さない限り、購入の話題に戻らないでください。',
    salesAskAddress:
      '- 注文確認時に配送先住所を尋ねる。形式：「通りと番地、地区、市区町村、都道府県」。住所を捏造しないでください。',
    salesAskPhone:
      '- 注文確認時に電話番号を尋ねる。数字と+のみ。番号を捏造しないでください。',
    salesCancellationAllowed:
      '顧客は購入から{hours}時間以内に注文をキャンセルできます。猶予时间内にキャンセルを依頼された場合は、1回だけ確認してください。猶予時間を過ぎている場合は、人間のサポートにエスカレートすると伝えしてください。',
    salesCancellationDenied:
      'チャットからのキャンセルは利用できません。顧客がキャンセルを依頼した場合は、カスタマーサポートに直接連絡するよう伝えてください。',
  },
  tour: {
    dialogLabel: 'チュートリアル',
    closeLabel: 'チュートリアルを閉じる',
    tutorialButton: 'チュートリアル',
    offerTitle: '使い方を確認しますか？',
    offerDesc: 'このページの各ボタンの機能をMIAが案内できます。',
    offerStart: 'チュートリアルを見る',
    offerDismiss: '今はしない',
    skip: 'スキップ',
    back: '戻る',
    next: '次へ',
    finish: '完了',
    step: (current: number, total: number) => `${current} / ${total}`,
    shell: {
      nav: {
        title: 'ナビゲーション',
        desc: 'ここからMIA内を移動します。「今日」「学ぶ」「成長」「設定」がすべてのセクションをまとめています。',
      },
      module: {
        title: 'アクティブなモジュール',
        desc: 'MIAが作業するモジュールを切り替えます: 営業・在庫・物流。それぞれが画面の配色とセクションを変えます。',
      },
      theme: {
        title: 'ライト / ダークモード',
        desc: '明るいテーマと暗いテーマを切り替えて、目に優しくします。',
      },
      language: {
        title: '言語',
        desc: 'MIAの言語を選びます: スペイン語・英語・ポルトガル語・日本語。',
      },
      signals: {
        title: 'MIAのシグナル',
        desc: 'MIAが検出したシグナル（売上・フォローアップ・興味深いデータ）がここに届きます。開いて受信トレイを確認します。',
      },
      mia: {
        title: 'MIAの状態',
        desc: 'MIAの状態を表示します: 稼働中・学習中・休憩中。クリックで変更するか「ヘルス」へ移動できます。',
      },
    },
    home: {
      vitals: {
        title: '今日の指標',
        desc: '過去24時間のビジネスの状況です: アクティブな会話・新規顧客・対応メッセージ・MIAの準備度。',
      },
      modules: {
        title: 'MIAのゾーン',
        desc: '主要モジュールへのショートカット: メモリ・思考・ラボ。それぞれMIAの活動の概要が表示されます。',
      },
      report: {
        title: '週次レポート',
        desc: '毎週月曜日にMIAが週のまとめを作成します: 会話・学び・成長のための推奨事項。',
      },
    },
    conversations: {
      search: {
        title: '会話を検索',
        desc: '顧客の名前・電話・メールで会話を検索します。',
      },
      status: {
        title: 'ステータスで絞り込み',
        desc: 'ステータスで会話を絞り込みます: アクティブ・待機中・完了・放棄・アーカイブ。',
      },
      assistant: {
        title: 'アシスタントで絞り込み',
        desc: '複数のアシスタントがある場合、どのアシスタントの会話を見るか選べます。',
      },
      list: {
        title: '会話リスト',
        desc: '各会話に顧客・最終アクティビティ・概要が表示されます。展開するとメモリとメモが見られます。',
      },
    },
    knowledge: {
      tabKnowledge: {
        title: 'ナレッジベース',
        desc: 'MIAが顧客対応に必要な事業の事実と情報です。',
      },
      tabMedia: {
        title: 'メディアライブラリ',
        desc: '会話の文脈に応じてMIAが送る画像やお客様の声です。',
      },
      tabInstructions: {
        title: 'AIの指示',
        desc: 'MIAの行動と性格のルール: 応答の仕方と優先順位です。',
      },
      tabFiles: {
        title: 'ファイル',
        desc: 'ドキュメントでMIAに教えます。ファイルをアップロードすると自動的に学習します。',
      },
    },
    catalog: {
      actions: {
        title: 'カタログの操作',
        desc: '一般メディアでライブラリを開き、インポートで商品を読み込み、新規商品でSKUと価格を手入力します。',
      },
      grid: {
        title: '商品一覧',
        desc: '各カードが商品です。クリックでメディア管理・編集・削除ができます。',
      },
    },
    studio: {
      analyze: {
        title: '分析を実行',
        desc: 'MIAの知識ベースを分析し、顧客対応の準備度を算出します。',
      },
      score: {
        title: '準備度スコア',
        desc: 'MIAの総合準備度スコア。完全性・一貫性・準備度に分けて表示します。',
      },
      stats: {
        title: '分析結果',
        desc: '分析の簡単なまとめ: 検出された問題と、承認済み・保留中の提案です。',
      },
      suggestions: {
        title: 'MIAの提案',
        desc: 'MIAが具体的な知識改善を提案します。フィルタして確認し、有用なものを承認してください。',
      },
    },
    delivery: {
      routes: {
        title: 'ルート',
        desc: '配送ルートを作成・管理します。保留中の注文をドライバーと日付に割り当てます。',
      },
      drivers: {
        title: 'ドライバー',
        desc: '配送担当者を追加し、アクセスリンクを生成してステータスを管理します。',
      },
      orders: {
        title: '注文',
        desc: 'ステータス別に注文を表示: 未割当・割当済・配達済・問題あり・キャンセル済。',
      },
      closures: {
        title: '日次締め',
        desc: '配送の一日を締めます: 現金を数え、予想と実績を照合し、メモを追加します。',
      },
    },
  },
}
