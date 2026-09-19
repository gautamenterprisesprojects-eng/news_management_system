/* ============================================================
   REPORTER PAGE — Submit news + view own submissions
   ============================================================ */

let reporterTab = 'submit';

function renderReporter() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${renderTopBar('reporter.title', null, 'newspaper')}
        <main class="page-content" id="reporterContent">
        </main>
        ${renderBottomNav('reporter', reporterTab)}
    `;
    applyLanguage();
    switchTab(reporterTab);
    maybeShowReporterWelcome();
}

/* ── First-login welcome popup (reporter accounts only, shown once) ─── */

// Keep in sync with REPORTER_TERMS_VERSION in server/routes/reporter.js.
const REPORTER_TERMS_VERSION = 'v1.0-2026-09-19';
const REPORTER_TERMS_EFFECTIVE_DATE = '19 सितंबर 2026';

const REPORTER_TERMS_SECTIONS = [
    ['A. सामान्य नियम', [
        'यह प्रणाली The Cliff News को समाचार, रिपोर्ट, फोटो, वीडियो, दस्तावेज़, ऑडियो तथा अन्य पत्रकारिता-संबंधी सामग्री प्रस्तुत करने के लिए बनाई गई है।',
        'समाचार प्रस्तुत करने मात्र से उसके प्रकाशन, प्रसारण या प्रसार की कोई गारंटी नहीं मिलती।',
        'The Cliff News को प्राप्त सामग्री की समीक्षा, संपादन, सत्यापन, संशोधन, स्थगन, अस्वीकृति, हटाने अथवा प्रकाशित न करने का पूर्ण संपादकीय अधिकार रहेगा।',
        'किसी समाचार का स्वीकार किया जाना यह प्रमाण नहीं माना जाएगा कि The Cliff News ने उसके प्रत्येक तथ्य की स्वतंत्र रूप से पुष्टि कर ली है।',
        'समाचार प्रस्तुत करने वाला व्यक्ति स्वयं को सही नाम, पहचान और आवश्यक विवरण के साथ पंजीकृत करेगा।',
        'उपयोगकर्ता अपने खाते की जानकारी सही और अद्यतन रखने के लिए स्वयं जिम्मेदार होगा।',
        'एक व्यक्ति किसी दूसरे व्यक्ति की पहचान का उपयोग करके खाता नहीं बनाएगा।',
        'किसी अन्य रिपोर्टर, पत्रकार, संस्था अथवा व्यक्ति की पहचान का दुरुपयोग प्रतिबंधित है।',
        'उपयोगकर्ता अपने लॉगिन विवरण को सुरक्षित रखने के लिए जिम्मेदार होगा।',
        'खाते से की गई गतिविधियों की जिम्मेदारी प्रारंभिक रूप से संबंधित खाताधारक की होगी, जब तक कि अनधिकृत उपयोग की सूचना उचित माध्यम से न दी गई हो।'
    ]],
    ['B. समाचार की सत्यता एवं जिम्मेदारी', [
        'समाचार प्रस्तुत करते समय रिपोर्टर यह घोषित करता है कि उसके सर्वोत्तम ज्ञान और विश्वास के अनुसार प्रस्तुत तथ्य सत्य, सही और भ्रामक नहीं हैं।',
        'रिपोर्टर जानबूझकर झूठी, मनगढ़ंत, काल्पनिक अथवा भ्रामक खबर को वास्तविक समाचार के रूप में प्रस्तुत नहीं करेगा।',
        'रिपोर्टर अफवाह, अपुष्ट सोशल मीडिया पोस्ट अथवा किसी तीसरे व्यक्ति के दावे को तथ्य के रूप में प्रस्तुत नहीं करेगा।',
        'जहां जानकारी अपुष्ट, प्रारंभिक अथवा कथित हो, वहां उसकी स्थिति स्पष्ट रूप से बताई जानी चाहिए।',
        'गंभीर आरोपों के संबंध में उपलब्ध स्रोत, दस्तावेज़ अथवा अन्य सत्यापन योग्य आधार प्रदान करना रिपोर्टर की जिम्मेदारी है।',
        'रिपोर्टर किसी व्यक्ति, संस्था, कंपनी अथवा संगठन पर तथ्यहीन आरोप लगाने से बचेगा।',
        'रिपोर्टर जानबूझकर ऐसा शीर्षक, फोटो या विवरण नहीं देगा जो वास्तविक सामग्री से अलग या भ्रामक अर्थ उत्पन्न करे।',
        'रिपोर्टर समाचार के संदर्भ, तारीख, स्थान और संबंधित व्यक्तियों की जानकारी यथासंभव सही देगा।',
        'यदि रिपोर्टर को बाद में पता चलता है कि प्रस्तुत समाचार में कोई तथ्यात्मक त्रुटि है, तो वह तुरंत The Cliff News को सूचित करेगा।',
        'गलत जानकारी को जानबूझकर छिपाना भी इन नियमों का उल्लंघन माना जा सकता है।'
    ]],
    ['C. स्रोत एवं प्रमाण', [
        'रिपोर्टर को जहां संभव हो, समाचार के प्राथमिक अथवा विश्वसनीय स्रोत की जानकारी उपलब्ध करानी चाहिए।',
        'आधिकारिक दस्तावेज़, सरकारी सूचना, प्रत्यक्ष बयान, प्रत्यक्षदर्शी विवरण अथवा अन्य विश्वसनीय स्रोतों का उपयोग करते समय उनकी प्रकृति स्पष्ट रखी जानी चाहिए।',
        'किसी व्यक्ति के बयान को तोड़-मरोड़कर प्रस्तुत नहीं किया जाएगा।',
        'किसी बयान को उसके मूल अर्थ से अलग संदर्भ में प्रस्तुत नहीं किया जाएगा।',
        'रिपोर्टर किसी दस्तावेज़, स्क्रीनशॉट, फोटो या वीडियो में जानबूझकर ऐसी छेड़छाड़ नहीं करेगा जिससे उसका अर्थ बदल जाए।',
        'नकली दस्तावेज़, नकली आदेश, नकली स्क्रीनशॉट अथवा कृत्रिम रूप से तैयार किए गए प्रमाण को वास्तविक प्रमाण के रूप में प्रस्तुत करना निषिद्ध है।',
        'आवश्यकता पड़ने पर The Cliff News रिपोर्टर से अतिरिक्त प्रमाण, स्रोत या स्पष्टीकरण मांग सकता है।',
        'रिपोर्टर द्वारा उपलब्ध कराई गई जानकारी की स्वतंत्र पुष्टि करना या न करना The Cliff News के संपादकीय विवेक पर निर्भर करेगा।'
    ]],
    ['D. कानूनी जिम्मेदारी', [
        'समाचार प्रस्तुत करने वाला रिपोर्टर अपने द्वारा प्रस्तुत सामग्री की वैधानिकता के लिए प्राथमिक रूप से जिम्मेदार होगा।',
        'रिपोर्टर ऐसी सामग्री प्रस्तुत नहीं करेगा जो किसी लागू कानून, न्यायालय के आदेश अथवा वैधानिक प्रतिबंध का उल्लंघन करती हो।',
        'रिपोर्टर किसी व्यक्ति के विरुद्ध जानबूझकर झूठा, दुर्भावनापूर्ण अथवा तथ्यहीन आरोप प्रकाशित कराने का प्रयास नहीं करेगा।',
        'किसी व्यक्ति की प्रतिष्ठा को अनावश्यक रूप से नुकसान पहुंचाने वाली सामग्री से बचना रिपोर्टर की जिम्मेदारी होगी।',
        'किसी न्यायिक, प्रशासनिक अथवा वैधानिक प्रक्रिया के संबंध में रिपोर्टिंग करते समय लागू प्रतिबंधों का पालन करना आवश्यक होगा।',
        'संवेदनशील मामलों में रिपोर्टर को लागू कानूनी प्रतिबंधों और पहचान-सुरक्षा संबंधी आवश्यकताओं का पालन करना होगा।',
        'The Cliff News को यह अधिकार रहेगा कि संभावित कानूनी जोखिम वाली सामग्री को प्रकाशित न करे अथवा अतिरिक्त सत्यापन की मांग करे।',
        'The Cliff News किसी रिपोर्टर द्वारा दी गई व्यक्तिगत गारंटी को किसी तीसरे पक्ष के समक्ष अपनी स्वतंत्र गारंटी के रूप में स्वीकार नहीं करता।',
        'रिपोर्टर यह समझता है कि किसी सामग्री का प्रकाशन संपादकीय स्वीकृति के अधीन है और प्रकाशन की कोई बाध्यता नहीं है।'
    ]],
    ['E. कॉपीराइट एवं बौद्धिक संपदा', [
        'रिपोर्टर केवल वही सामग्री प्रस्तुत करेगा जिसे प्रस्तुत करने और उपयोग करने का उसके पास वैध अधिकार है।',
        'किसी अन्य वेबसाइट, समाचार संस्था, पत्रकार, फोटोग्राफर या निर्माता की सामग्री को बिना अधिकार के अपनी सामग्री बताकर प्रस्तुत करना निषिद्ध है।',
        'कॉपीराइट-संरक्षित फोटो, वीडियो, लेख, ग्राफिक्स, ऑडियो अथवा दस्तावेज़ का अनधिकृत उपयोग रिपोर्टर की जिम्मेदारी होगा।',
        'जहां आवश्यक हो, सामग्री के मूल लेखक, स्रोत या अधिकारधारी की जानकारी उपलब्ध कराई जानी चाहिए।',
        'रिपोर्टर द्वारा प्रस्तुत सामग्री के संबंध में आवश्यक अनुमति अथवा लाइसेंस प्राप्त करना रिपोर्टर की जिम्मेदारी होगी।',
        'रिपोर्टर The Cliff News को प्रस्तुत सामग्री को समाचार संपादन, प्रारूपण, अनुवाद, शीर्षक, लेआउट, डिजिटल प्रकाशन और संबंधित पत्रकारिता उपयोग के लिए आवश्यक सीमित अधिकार प्रदान करता है, बशर्ते यह अधिकार लागू कानून और अलग से किए गए किसी लिखित समझौते के अधीन हों।',
        'रिपोर्टर किसी तीसरे पक्ष के अधिकारों के उल्लंघन से उत्पन्न दावे के संबंध में The Cliff News को उपलब्ध तथ्य और दस्तावेज़ प्रदान करेगा।'
    ]],
    ['F. फोटो, वीडियो एवं अन्य मीडिया', [
        'फोटो या वीडियो प्रस्तुत करने वाला व्यक्ति यह पुष्टि करता है कि उसे उस सामग्री को प्रस्तुत करने का अधिकार है या उसने उचित अनुमति प्राप्त की है।',
        'किसी व्यक्ति की फोटो/वीडियो का उपयोग करते समय लागू गोपनीयता और अन्य कानूनी अधिकारों का सम्मान किया जाएगा।',
        'आपत्तिजनक, अश्लील, हिंसक, अवैध या स्पष्ट रूप से अनुचित सामग्री प्रस्तुत करना प्रतिबंधित है, सिवाय उस पत्रकारिता संदर्भ के जहां कानून और संपादकीय नीति इसकी अनुमति देते हों।',
        'किसी घटना के फोटो या वीडियो को जानबूझकर गलत घटना, स्थान या तारीख से जोड़कर प्रस्तुत नहीं किया जाएगा।'
    ]],
    ['G. गोपनीयता एवं व्यक्तिगत जानकारी', [
        'रिपोर्टर किसी व्यक्ति की निजी या संवेदनशील जानकारी को बिना उचित पत्रकारिता अथवा कानूनी आधार के प्रस्तुत नहीं करेगा।',
        'निजी फोन नंबर, पासवर्ड, बैंक विवरण, पहचान संबंधी संवेदनशील जानकारी या अन्य निजी डेटा को अनावश्यक रूप से समाचार में शामिल नहीं किया जाएगा।',
        'रिपोर्टर को प्राप्त निजी जानकारी का उपयोग केवल वैध और अधिकृत उद्देश्य के लिए करना चाहिए।',
        'The Cliff News को प्रस्तुत सामग्री में तीसरे पक्ष की निजी जानकारी शामिल होने पर रिपोर्टर उसके उपयोग की वैधता के लिए जिम्मेदार हो सकता है।',
        'किसी व्यक्ति के निजी खाते, डिवाइस, ईमेल या सिस्टम से अनधिकृत तरीके से जानकारी प्राप्त करना प्रतिबंधित है।'
    ]],
    ['H. प्रतिबंधित सामग्री एवं आचरण', [
        'किसी भी प्रकार की धोखाधड़ी, जालसाजी या जानबूझकर गलत पहचान का उपयोग प्रतिबंधित है।',
        'किसी व्यक्ति या संस्था को नुकसान पहुंचाने के उद्देश्य से झूठी सामग्री प्रस्तुत करना प्रतिबंधित है।',
        'धमकी, उत्पीड़न, ब्लैकमेल अथवा जबरदस्ती से संबंधित सामग्री प्रस्तुत करने का दुरुपयोग प्रतिबंधित है।',
        'किसी समुदाय, व्यक्ति या समूह के विरुद्ध गैरकानूनी घृणा या हिंसा को बढ़ावा देने वाली सामग्री प्रतिबंधित है।',
        'किसी अपराध को करने, छिपाने या उससे बचने में सहायता करने वाली सामग्री प्रस्तुत नहीं की जाएगी।',
        'दुर्भावनापूर्ण अफवाहों को जानबूझकर समाचार के रूप में फैलाना प्रतिबंधित है।',
        'फर्जी सरकारी आदेश, फर्जी प्रेस नोट अथवा फर्जी आधिकारिक संचार प्रस्तुत करना गंभीर उल्लंघन माना जाएगा।'
    ]],
    ['I. सिस्टम, साइबर सुरक्षा एवं तकनीकी उपयोग', [
        'उपयोगकर्ता The Cliff News के पोर्टल, ऐप या सर्वर की सुरक्षा को नुकसान पहुंचाने का प्रयास नहीं करेगा।',
        'सिस्टम में अनधिकृत प्रवेश, पासवर्ड चोरी, सत्र-हाइजैकिंग या किसी अन्य खाते में प्रवेश का प्रयास प्रतिबंधित है।',
        'वेबसाइट, ऐप या पोर्टल के कोड में अनधिकृत बदलाव करने का प्रयास प्रतिबंधित है।',
        'किसी सुरक्षा कमजोरी का दुरुपयोग करना, बिना अनुमति सुरक्षा परीक्षण करना या सुरक्षा व्यवस्था को दरकिनार करना प्रतिबंधित है।',
        'वायरस, मैलवेयर, रैनसमवेयर, दुर्भावनापूर्ण स्क्रिप्ट या अन्य हानिकारक कोड अपलोड करना प्रतिबंधित है।',
        'सिस्टम पर असामान्य मात्रा में अनुरोध भेजकर सेवा बाधित करने का प्रयास प्रतिबंधित है।',
        'किसी अन्य उपयोगकर्ता के डेटा, खाते या निजी क्षेत्र तक अनधिकृत पहुंच प्राप्त करने का प्रयास प्रतिबंधित है।',
        'The Cliff News के सिस्टम से डेटा को अनधिकृत तरीके से कॉपी, निकालना, स्क्रैप करना, बेचना या वितरित करना प्रतिबंधित है।',
        'स्वचालित बॉट, स्क्रिप्ट या अन्य तकनीकी साधनों का उपयोग करके पोर्टल के संचालन में हस्तक्षेप करना प्रतिबंधित है, जब तक कि The Cliff News ने लिखित अनुमति न दी हो।',
        'किसी भी प्रकार की reverse engineering, unauthorized extraction या सुरक्षा नियंत्रण को bypass करने का प्रयास प्रतिबंधित है।'
    ]],
    ['J. संपादकीय अधिकार', [
        'The Cliff News किसी भी समाचार को स्वीकार, संशोधित, स्थगित, अस्वीकार या हटाने का अधिकार रखता है।',
        'संपादकीय टीम शीर्षक, भाषा, व्याकरण, फोटो, संरचना और प्रस्तुति में आवश्यक परिवर्तन कर सकती है।',
        'संपादन का उद्देश्य सामग्री को पत्रकारिता मानकों, कानूनी आवश्यकताओं और प्रकाशन प्रारूप के अनुरूप बनाना हो सकता है।',
        'समाचार स्वीकार किए जाने के बावजूद उसका वेबसाइट, समाचारपत्र, सोशल मीडिया या अन्य प्लेटफॉर्म पर प्रकाशन अनिवार्य नहीं है।',
        'किसी एक प्लेटफॉर्म पर प्रकाशित सामग्री को दूसरे प्लेटफॉर्म पर प्रकाशित करना आवश्यक नहीं है।',
        'The Cliff News किसी समाचार के प्रकाशन की तारीख, समय, स्थान या संस्करण का निर्णय अपने संपादकीय विवेक से कर सकता है।',
        'आवश्यक परिस्थितियों में प्रकाशित सामग्री में correction, clarification, update अथवा removal किया जा सकता है।'
    ]],
    ['K. प्रकाशन एवं वितरण', [
        'रिपोर्टर यह समझता है कि स्वीकृत समाचार वेबसाइट, प्रिंटेड समाचारपत्र, मोबाइल ऐप, सोशल मीडिया और अन्य अधिकृत माध्यमों पर प्रकाशित हो सकता है।',
        'डिजिटल प्लेटफॉर्म पर प्रकाशित सामग्री का प्रदर्शन, पहुंच, पाठक संख्या या engagement किसी निश्चित संख्या में होने की गारंटी नहीं है।',
        'सोशल मीडिया प्लेटफॉर्म, सर्च इंजन या अन्य बाहरी सेवाओं के एल्गोरिदम, नीतियों या तकनीकी समस्याओं के लिए The Cliff News जिम्मेदार नहीं होगा।',
        'बाहरी प्लेटफॉर्म द्वारा किसी सामग्री को हटाने, सीमित करने या कम दिखाने पर The Cliff News उस बाहरी निर्णय के लिए जिम्मेदार नहीं होगा।'
    ]],
    ['L. भुगतान, क्रेडिट एवं प्रकाशन संबंधी अपेक्षाएं', [
        'किसी समाचार को प्रकाशित करने से अपने-आप किसी भुगतान, पारिश्रमिक, कमीशन या अन्य आर्थिक लाभ का अधिकार उत्पन्न नहीं होता, जब तक अलग लिखित समझौता न हो।',
        'रिपोर्टर को दिया जाने वाला किसी भी प्रकार का पारिश्रमिक, यदि लागू हो, तो संबंधित संस्था की अलग नीति या लिखित समझौते के अनुसार होगा।',
        'रिपोर्टर को समाचार में अपना नाम/क्रेडिट मिलने की गारंटी नहीं है; क्रेडिट का प्रारूप संपादकीय नीति के अनुसार निर्धारित किया जा सकता है।'
    ]],
    ['M. शिकायत, सुधार एवं हटाने का अनुरोध', [
        'यदि किसी व्यक्ति या संस्था को प्रकाशित सामग्री के संबंध में तथ्यात्मक त्रुटि या वैध आपत्ति हो, तो वह निर्धारित माध्यम से The Cliff News से संपर्क कर सकता है।',
        'रिपोर्टर किसी प्रकाशित समाचार में गंभीर तथ्यात्मक गलती की जानकारी मिलते ही संपादकीय टीम को सूचित करेगा।',
        'correction, clarification, update अथवा removal का निर्णय उपलब्ध तथ्यों, लागू कानून और संपादकीय नीति के आधार पर लिया जाएगा।'
    ]],
    ['N. क्षतिपूर्ति एवं दावे', [
        'जहां लागू कानून इसकी अनुमति देता है, रिपोर्टर द्वारा जानबूझकर या लापरवाही से किए गए गलत प्रस्तुतीकरण, अनधिकृत सामग्री, अधिकार-उल्लंघन अथवा इन नियमों के उल्लंघन से उत्पन्न तीसरे पक्ष के दावों के संबंध में रिपोर्टर से आवश्यक सहयोग और क्षतिपूर्ति की मांग की जा सकती है।',
        'रिपोर्टर स्वीकार करता है कि The Cliff News को केवल समाचार प्रस्तुत किए जाने के कारण उसके द्वारा किए गए किसी स्वतंत्र, गैर-अधिकृत, गैरकानूनी या गलत कार्य की स्वचालित जिम्मेदारी नहीं मानी जाएगी।',
        'इन नियमों की कोई भी धारा ऐसी कानूनी जिम्मेदारी को समाप्त करने का दावा नहीं करती जिसे लागू कानून के अंतर्गत अनुबंध द्वारा समाप्त नहीं किया जा सकता। यदि किसी धारा का कोई भाग किसी सक्षम प्राधिकारी द्वारा अमान्य माना जाता है, तो शेष नियम यथासंभव प्रभावी रहेंगे।'
    ]],
    ['O. खाता निलंबन एवं समाप्ति', [
        'The Cliff News गंभीर उल्लंघन, धोखाधड़ी, गलत पहचान, बार-बार गलत सूचना, सिस्टम के दुरुपयोग, सुरक्षा उल्लंघन या अन्य उचित कारणों के आधार पर किसी खाते को अस्थायी रूप से निलंबित अथवा समाप्त कर सकता है।',
        'खाता समाप्त होने के बाद भी समाचार से संबंधित पहले से उत्पन्न कानूनी, कॉपीराइट, गोपनीयता, क्षतिपूर्ति या अन्य दायित्व, जहां लागू हों, समाप्त नहीं होंगे।'
    ]]
];

const REPORTER_TERMS_ACKNOWLEDGEMENTS = [
    'मैंने इन नियम एवं शर्तों को पढ़ा है।',
    'मैंने इनके अर्थ को समझा है।',
    'मुझे इन्हें पढ़ने और समझने का पर्याप्त अवसर दिया गया है।',
    'मैं अपनी इच्छा से इन्हें स्वीकार कर रहा/रही हूँ।',
    'मेरे द्वारा दी गई जानकारी मेरी जानकारी के अनुसार सही है।',
    'मेरे द्वारा प्रस्तुत समाचार सत्य, प्रमाणित और गैर-भ्रामक होने चाहिए।',
    'मैं जानता/जानती हूँ कि समाचार प्रस्तुत करना उसके प्रकाशन की गारंटी नहीं है।',
    'मैं समझता/समझती हूँ कि The Cliff News सामग्री को संपादित, अस्वीकार, स्थगित या हटाने का अधिकार रखता है।',
    'मैं समझता/समझती हूँ कि किसी तीसरे पक्ष के अधिकारों का उल्लंघन करने वाली सामग्री प्रस्तुत करने की जिम्मेदारी मेरी हो सकती है।',
    'मैं समझता/समझती हूँ कि मेरे खाते का दुरुपयोग, सिस्टम में अनधिकृत प्रवेश या तकनीकी छेड़छाड़ निषिद्ध है।',
    'मैं समझता/समझती हूँ कि आवश्यक परिस्थितियों में मुझसे अतिरिक्त प्रमाण या स्पष्टीकरण मांगा जा सकता है।',
    'मैं इन नियम एवं शर्तों को स्वेच्छा से और पूर्ण होशो-हवास में स्वीकार करता/करती हूँ।'
];

function renderReporterTermsHtml() {
    const sectionsHtml = REPORTER_TERMS_SECTIONS.map(([title, points]) => `
        <h4 class="terms-section-title">${title}</h4>
        ${points.map(p => `<p class="terms-point">${p}</p>`).join('')}
    `).join('');

    const ackHtml = REPORTER_TERMS_ACKNOWLEDGEMENTS.map(a => `<p class="terms-point">${a}</p>`).join('');

    return `
        <div class="terms-meta">
            <div>प्रभावी तिथि: ${REPORTER_TERMS_EFFECTIVE_DATE}</div>
            <div>संस्करण: ${REPORTER_TERMS_VERSION}</div>
        </div>
        <p>इन नियमों एवं शर्तों ("नियम एवं शर्तें") को ध्यानपूर्वक पढ़ें। The Cliff News ("The Cliff News", "हम", "हमारा", "हमारी संस्था") के रिपोर्टर/संवाददाता/कंटेंट सबमिटर पोर्टल पर खाता बनाते समय, पहली बार लॉगिन करते समय अथवा समाचार प्रस्तुत करने से पहले "मैंने नियम एवं शर्तें पढ़ ली हैं और मैं इन्हें स्वीकार करता/करती हूँ" विकल्प पर सहमति देना इस बात की पुष्टि माना जाएगा कि उपयोगकर्ता ने इन नियमों को पढ़ा, समझा और स्वेच्छा से स्वीकार किया है।</p>

        ${sectionsHtml}

        <h4 class="terms-section-title">P. इलेक्ट्रॉनिक स्वीकृति</h4>
        <p>मैं पुष्टि करता/करती हूँ कि:</p>
        ${ackHtml}

        <div class="terms-declaration">
            "मैंने उपरोक्त सभी नियम एवं शर्तें पढ़ ली हैं, समझ ली हैं और मैं उनसे सहमत हूँ। मैं पुष्टि करता/करती हूँ कि मेरे द्वारा प्रस्तुत की जाने वाली समाचार सामग्री मेरी जानकारी और विश्वास के अनुसार सत्य, सही और गैर-भ्रामक होगी तथा मैं किसी अन्य व्यक्ति या संस्था के अधिकारों का जानबूझकर उल्लंघन नहीं करूंगा/करूंगी।"
        </div>

        <label class="terms-checkbox-row">
            <input type="checkbox" id="reporterTermsCheckbox">
            <span>मैंने नियम एवं शर्तें पढ़ ली हैं और मैं इन्हें स्वीकार करता/करती हूँ।</span>
        </label>
        <button type="button" class="welcome-cta-btn" id="reporterTermsAcceptBtn" disabled>स्वीकार करें एवं आगे बढ़ें</button>
    `;
}

async function postReporterTermsAcceptance() {
    const role = getCurrentUser()?.role;
    const endpoint = role === 'sub_editor' ? '/sub-editor/terms/accept' : '/reporter/terms/accept';
    try {
        await api(endpoint, { method: 'POST' });
    } catch (err) {
        console.error('Failed to record terms acceptance:', err);
    }
}

function reporterWelcomeStorageKey() {
    const uid = getCurrentUser()?.id || 'anon';
    return `cliff_reporter_welcome_seen_${uid}`;
}

function maybeShowReporterWelcome() {
    try {
        if (localStorage.getItem(reporterWelcomeStorageKey())) return;
    } catch {
        return; // localStorage unavailable -- never block the dashboard for this
    }
    // Let the dashboard paint first; the welcome card fades in a beat later.
    setTimeout(showReporterWelcomePopup, 200);
}

function showReporterWelcomePopup() {
    if (document.getElementById('reporterWelcomeDialog')) return;

    const html = `
        <div class="welcome-overlay" id="reporterWelcomeDialog">
            <div class="welcome-dialog">
                <button type="button" class="welcome-close-btn" id="reporterWelcomeCloseX" aria-label="Close">${icon('x', 16)}</button>
                <div class="welcome-body" id="reporterWelcomeBody">
                    <div class="welcome-head">
                        <img class="welcome-logo" src="/images/logo.png" alt="The Cliff News">
                        <h2 class="welcome-title">Welcome to The Cliff News</h2>
                        <p class="welcome-subtitle">द क्लिफ न्यूज़ में आपका हार्दिक स्वागत है!</p>

                        <div class="welcome-tab-toggle" id="reporterWelcomeTabToggle">
                            <span class="welcome-tab-option active" data-tab="welcome">स्वागत</span>
                            <span class="welcome-tab-option" data-tab="terms">नियम व शर्तें</span>
                        </div>
                    </div>

                    <div class="welcome-divider"></div>

                    <div id="reporterWelcomePanelWelcome">
                        <p>आपका स्वागत है एक ऐसे समाचार नेटवर्क में, जिसकी पहुंच देश ही नहीं, बल्कि दुनिया भर तक है। हमारे विस्तृत प्रिंटेड न्यूज़ नेटवर्क के साथ-साथ अब आपकी खबरें और आपका नाम इन माध्यमों से भी लाखों लोगों तक पहुंचने का अवसर रखते हैं:</p>

                        <div class="welcome-feature-row">
                            <div class="welcome-feature-icon">${icon('newspaper', 20)}</div>
                            <div class="welcome-feature-text">विस्तृत प्रिंटेड न्यूज़ नेटवर्क</div>
                        </div>
                        <div class="welcome-feature-row">
                            <div class="welcome-feature-icon">${icon('smartphone', 20)}</div>
                            <div class="welcome-feature-text">एंड्रॉयड और एप्पल आईओएस ऐप, वेबसाइट</div>
                        </div>
                        <div class="welcome-feature-row">
                            <div class="welcome-feature-icon">${icon('link', 20)}</div>
                            <div class="welcome-feature-text">इंस्टाग्राम, फेसबुक, लिंक्डइन, यूट्यूब और गूगल</div>
                        </div>

                        <div class="welcome-box">
                            <h3>🌟 यदि आप पहली बार जुड़े हैं</h3>
                            <p>द क्लिफ न्यूज़ परिवार से जुड़ने के लिए आपको बहुत-बहुत बधाई! अब आप एक ऐसे समाचार नेटवर्क का हिस्सा हैं, जहां आपकी मेहनत, आपकी खबरें और आपकी पहचान को बड़े दर्शक वर्ग तक पहुंचने का अवसर मिलता है।</p>
                        </div>

                        <div class="welcome-box">
                            <h3>❤️ यदि आप हमारे पुराने साथी हैं</h3>
                            <p>द क्लिफ न्यूज़ के साथ आपकी निरंतर मेहनत, सक्रियता और निरंतरता के लिए हम आपका दिल से धन्यवाद करते हैं। आपका निरंतर योगदान हमारे समाचार नेटवर्क को और मजबूत बनाता है।</p>
                        </div>

                        <div class="welcome-box">
                            <h3>🏆 अब शुरू होती है आपकी "रेस टू व्यूज़"</h3>
                            <p>आज से आप "रेस टू व्यूज़" का भी हिस्सा हैं। आप जितनी अच्छी, महत्वपूर्ण, विश्वसनीय और प्रभावशाली खबरें भेजेंगे, आपकी खबरों के अधिक से अधिक लोगों तक पहुंचने की संभावना उतनी ही बढ़ेगी।</p>
                            <p>अन्य रिपोर्टरों, संवाददाताओं और संवाद-प्रतिनिधियों के साथ इस सफर में आगे बढ़िए, अपनी पत्रकारिता की एक अलग पहचान बनाइए और अपनी खबरों को अधिक से अधिक लोगों तक पहुंचाइए।</p>
                            <div class="welcome-highlight">
                                आपकी खबर — आपकी पहचान।<br>
                                आपकी मेहनत — आपकी पहुंच।
                            </div>
                            <p>अपने क्षेत्र की महत्वपूर्ण खबरें लगातार भेजते रहें, सक्रिय रहें और बेहतर पत्रकारिता के माध्यम से अपनी पहचान को नई ऊंचाइयों तक ले जाएं।</p>
                        </div>

                        <div class="welcome-box">
                            <h3>🎯 "रेस टू व्यूज़" में आपकी यात्रा आज से शुरू होती है!</h3>
                            <p>द क्लिफ न्यूज़ परिवार में आपका स्वागत है।<br>आपके पत्रकारिता सफर के लिए ढेरों शुभकामनाएं! ❤️</p>
                        </div>

                        <p class="welcome-signature">— द क्लिफ न्यूज़ टीम</p>
                    </div>

                    <div id="reporterWelcomePanelTerms" class="hidden terms-panel">
                        ${renderReporterTermsHtml()}
                    </div>
                </div>
                <div class="welcome-scroll-fade"></div>
                <div class="welcome-footer">
                    <button type="button" class="welcome-cta-btn" id="reporterWelcomeCloseBtn">
                        Start Your Journey
                        <span class="welcome-cta-sub">अपना सफर शुरू करें</span>
                    </button>
                    <p class="welcome-terms-note">"Start Your Journey" पर क्लिक करके मैं सभी नियम एवं शर्तें (Terms &amp; Conditions) स्वीकार करता/करती हूँ।</p>
                    <p class="welcome-terms-note">(I hereby accept the terms and conditions)</p>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    document.body.style.overflow = 'hidden';
    document.getElementById('reporterWelcomeCloseBtn').onclick = () => acceptAndCloseReporterWelcome();
    document.getElementById('reporterWelcomeCloseX').onclick = () => acceptAndCloseReporterWelcome();

    const termsCheckbox = document.getElementById('reporterTermsCheckbox');
    const termsAcceptBtn = document.getElementById('reporterTermsAcceptBtn');
    if (termsCheckbox && termsAcceptBtn) {
        termsCheckbox.onchange = () => { termsAcceptBtn.disabled = !termsCheckbox.checked; };
        termsAcceptBtn.onclick = () => acceptAndCloseReporterWelcome();
    }

    // Hide the "more content below" fade once the reporter has scrolled near the bottom.
    const body = document.getElementById('reporterWelcomeBody');
    const fade = document.querySelector('#reporterWelcomeDialog .welcome-scroll-fade');
    const updateFade = () => {
        if (!body || !fade) return;
        const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 24;
        fade.style.opacity = atBottom ? '0' : '1';
    };
    if (body) body.addEventListener('scroll', updateFade, { passive: true });
    updateFade();

    // Tab toggle: switch between the welcome message and the full terms text.
    const tabToggle = document.getElementById('reporterWelcomeTabToggle');
    const panelWelcome = document.getElementById('reporterWelcomePanelWelcome');
    const panelTerms = document.getElementById('reporterWelcomePanelTerms');
    if (tabToggle) {
        tabToggle.onclick = (event) => {
            const opt = event.target.closest('.welcome-tab-option');
            if (!opt) return;
            tabToggle.querySelectorAll('.welcome-tab-option').forEach(el => el.classList.remove('active'));
            opt.classList.add('active');
            const showTerms = opt.dataset.tab === 'terms';
            panelWelcome.classList.toggle('hidden', showTerms);
            panelTerms.classList.toggle('hidden', !showTerms);
            if (body) body.scrollTop = 0;
            updateFade();
        };
    }
}

function acceptAndCloseReporterWelcome() {
    postReporterTermsAcceptance();
    const el = document.getElementById('reporterWelcomeDialog');
    if (el) el.remove();
    document.body.style.overflow = '';
    try { localStorage.setItem(reporterWelcomeStorageKey(), '1'); } catch { /* ignore */ }
}

function renderReporterSubmitTab() {
    const content = document.getElementById('reporterContent');
    content.innerHTML = `
        <div class="page-header">
            <h2 data-i18n="reporter.submit_news">${t('reporter.submit_news')}</h2>
        </div>

        <form id="newsForm">
            <div class="form-group">
                <label class="form-label" data-i18n="reporter.body">News Content</label>
                <textarea class="form-input" id="newsBody" required rows="6"
                          data-i18n-placeholder="reporter.body_placeholder"
                          placeholder="${t('reporter.body_placeholder')}"></textarea>
            </div>

            <div class="form-group">
                <label class="form-label" data-i18n="reporter.category">${t('reporter.category')}</label>
                <select class="form-input form-select" id="newsCategory" required>
                    <option value="regional" data-i18n="reporter.cat_regional" selected>${t('reporter.cat_regional')}</option>
                    <option value="regional_district" data-i18n="reporter.cat_regional_district">${t('reporter.cat_regional_district')}</option>
                    <option value="politics" data-i18n="reporter.cat_politics">${t('reporter.cat_politics')}</option>
                    <option value="crime" data-i18n="reporter.cat_crime">${t('reporter.cat_crime')}</option>
                    <option value="sports" data-i18n="reporter.cat_sports">${t('reporter.cat_sports')}</option>
                    <option value="business" data-i18n="reporter.cat_business">${t('reporter.cat_business')}</option>
                    <option value="entertainment" data-i18n="reporter.cat_entertainment">${t('reporter.cat_entertainment')}</option>
                    <option value="technology" data-i18n="reporter.cat_technology">${t('reporter.cat_technology')}</option>
                    <option value="health" data-i18n="reporter.cat_health">${t('reporter.cat_health')}</option>
                    <option value="education" data-i18n="reporter.cat_education">${t('reporter.cat_education')}</option>
                    <option value="local" data-i18n="reporter.cat_local">${t('reporter.cat_local')}</option>
                    <option value="national" data-i18n="reporter.cat_national">${t('reporter.cat_national')}</option>
                    <option value="international" data-i18n="reporter.cat_international">${t('reporter.cat_international')}</option>
                    <option value="other" data-i18n="reporter.cat_other">${t('reporter.cat_other')}</option>
                </select>
            </div>

            <div class="form-group">
                <label class="form-label" data-i18n="reporter.tags">${t('reporter.tags')}</label>
                <input type="text" class="form-input" id="newsTags"
                       data-i18n-placeholder="reporter.tags_placeholder"
                       placeholder="${t('reporter.tags_placeholder')}">
            </div>

            <div class="form-group">
                <label class="form-label" data-i18n="reporter.city">${t('reporter.city')}</label>
                <div style="position:relative;">
                    <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);display:flex;align-items:center;color:var(--text-secondary);">${icon('pin', 14)}</span>
                    <input type="text" class="form-input" id="newsCity" style="padding-left:30px;"
                           data-i18n-placeholder="reporter.city_placeholder"
                           placeholder="${t('reporter.city_placeholder')}">
                </div>
            </div>

            <!-- Multi-image upload -->
            <div class="form-group">
                <label class="form-label">
                    ${icon('photos', 14)} ${t('reporter.image') || 'Images'} <span style="color:var(--accent-orange);">*</span>
                    <span style="font-size:0.75rem;color:var(--text-secondary);font-weight:400;margin-left:6px;">(${t('reporter.image_multi_hint')})</span>
                </label>

                <!-- Drop zone -->
                <div class="image-upload-area multi-upload-zone" id="multiImageUploadArea" onclick="document.getElementById('newsImages').click()">
                    <div class="upload-icon-svg">${icon('upload', 28)}</div>
                    <div class="upload-text" data-i18n="reporter.image_upload">${t('reporter.image_upload')}</div>
                    <div class="upload-text" style="font-size:0.72rem;margin-top:4px;color:var(--text-secondary);">${t('reporter.image_upload_hint') || 'JPG, PNG, WebP • Max 10MB each'}</div>
                    <input type="file" id="newsImages" accept="image/*" multiple onchange="previewMultiImages(this)" style="display:none;">
                </div>

                <!-- Thumbnail strip -->
                <div class="multi-image-strip hidden" id="multiImageStrip"></div>
            </div>

            <button type="submit" class="btn btn-primary btn-full" id="submitBtn"
                    onclick="submitNews(event)" data-i18n="reporter.submit_btn">
                ${icon('send', 14)} ${t('reporter.submit_btn')}
            </button>
        </form>
    `;
    applyLanguage();
    setupMultiImageDrop();
}

/* ── Multi-image handling ─────────────────────────────────── */

let _selectedFiles = [];
const MAX_REPORTER_IMAGE_BYTES = 10 * 1024 * 1024;

function setupMultiImageDrop() {
    const zone = document.getElementById('multiImageUploadArea');
    if (!zone) return;

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        addFilesToStrip(files);
    });
}

function previewMultiImages(input) {
    const files = Array.from(input.files);
    addFilesToStrip(files);
    // Reset input so same files can be added again if needed
    input.value = '';
}

function addFilesToStrip(files) {
    files.forEach(f => {
        if (_selectedFiles.length >= 10) {
            showToast('Maximum 10 photos allowed', 'error');
            return;
        }
        if (!f.type || !f.type.startsWith('image/')) {
            showToast(`${f.name || 'Selected file'} is not an image`, 'error');
            return;
        }
        if (f.size > MAX_REPORTER_IMAGE_BYTES) {
            showToast(`${f.name || 'Selected image'} is larger than 10MB`, 'error');
            return;
        }
        _selectedFiles.push(f);
    });
    renderImageStrip();
}

function removeImageFromStrip(idx) {
    _selectedFiles.splice(idx, 1);
    renderImageStrip();
}

function renderImageStrip() {
    const strip = document.getElementById('multiImageStrip');
    const zone = document.getElementById('multiImageUploadArea');
    if (!strip) return;

    if (_selectedFiles.length === 0) {
        strip.classList.add('hidden');
        if (zone) zone.classList.remove('hidden');
        return;
    }

    strip.classList.remove('hidden');
    strip.innerHTML = _selectedFiles.map((f, idx) => {
        const url = URL.createObjectURL(f);
        return `
            <div class="multi-thumb-item" id="thumb-${idx}">
                <img src="${url}" alt="Image ${idx + 1}" class="multi-thumb-img">
                ${idx === 0 ? `<div class="multi-thumb-badge">Main</div>` : ''}
                <button type="button" class="multi-thumb-remove" onclick="removeImageFromStrip(${idx})" title="Remove">
                    ${icon('x', 10)}
                </button>
            </div>
        `;
    }).join('');

    // Add "add more" tile if under limit
    if (_selectedFiles.length < 10) {
        strip.innerHTML += `
            <div class="multi-thumb-add" onclick="document.getElementById('newsImages').click()" title="Add more">
                ${icon('plus', 20)}
                <span style="font-size:0.65rem;margin-top:2px;">Add</span>
            </div>
        `;
    }
}

/* ── Submit ──────────────────────────────────────────────── */

async function submitNews(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const body = document.getElementById('newsBody').value.trim();
    const headline = body.substring(0, 50).replace(/\n/g, ' ') + (body.length > 50 ? '...' : '');
    const category = document.getElementById('newsCategory').value;
    const tags = document.getElementById('newsTags').value.trim();
    const city = document.getElementById('newsCity').value.trim();

    if (!body || !category) {
        showToast(t('common.required'), 'error');
        return;
    }
    if (_selectedFiles.length < 1) {
        showToast(t('reporter.image_required'), 'error');
        const zone = document.getElementById('multiImageUploadArea');
        if (zone) {
            zone.classList.add('upload-required-flash');
            setTimeout(() => zone.classList.remove('upload-required-flash'), 1200);
        }
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `${icon('loader', 14)} ${t('reporter.submitting')}`;

    const formData = new FormData();
    formData.append('headline', headline);
    formData.append('body', body);
    formData.append('category', category);
    if (tags) formData.append('tags', tags);
    if (city) formData.append('city', city);

    // Append all selected images
    _selectedFiles.forEach(f => formData.append('images', f));

    try {
        const data = await api('/reporter/news', {
            method: 'POST',
            body: formData,
            isFormData: true
        });

        if (data.error) {
            showToast(data.error, 'error');
        } else {
            showToast(`${t('reporter.submit_success')} (Article ID: ${data.id})`, 'success');
            document.getElementById('newsForm').reset();
            _selectedFiles = [];
            renderImageStrip();
        }
    } catch (err) {
        showToast(t('common.error'), 'error');
    }

    btn.disabled = false;
    btn.innerHTML = `${icon('send', 14)} ${t('reporter.submit_btn')}`;
    applyLanguage();
}

/* ── My News tab ─────────────────────────────────────────── */

function renderReporterMyNewsTab() {
    const content = document.getElementById('reporterContent');
    content.innerHTML = `
        <div class="page-header">
            <h2 data-i18n="reporter.my_submissions">${t('reporter.my_submissions')}</h2>
        </div>
        <div id="myNewsList">
            <div class="loading-spinner" style="margin: 40px auto;"></div>
        </div>
    `;
    applyLanguage();
    loadMyNews();
}

async function loadMyNews() {
    const container = document.getElementById('myNewsList');
    try {
        const data = await api('/reporter/news');
        if (!data || !data.news || data.news.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-svg">${icon('inbox', 40)}</div>
                    <div class="empty-text" data-i18n="reporter.no_news">${t('reporter.no_news')}</div>
                </div>
            `;
            applyLanguage();
            return;
        }

        container.innerHTML = data.news.map(n => `
            <div class="card news-card">
                <div class="news-card-info">
                    <div class="news-card-headline"><span style="color:var(--accent-orange);margin-right:6px;">#${n.id}</span>${escapeHtml(n.headline)}</div>
                    <div class="news-card-meta">
                        <span class="status-badge ${n.status}">${t('editor.status_' + n.status) || n.status.toUpperCase()}</span>
                        ${n.status === 'raw' && n.sub_editor_status === 'forwarded' ? `<span class="status-badge forwarded">${icon('check', 10)} उप-संपादक द्वारा स्वीकृत</span>` : ''}
                        <span class="news-card-meta-item">${icon('folder', 12)} ${n.category}</span>
                        ${n.city ? `<span class="news-card-meta-item">${icon('pin', 12)} ${n.city}</span>` : ''}
                        <span class="news-card-meta-item">${icon('clock', 12)} ${formatDate(n.created_at)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

function renderReporterExternalLinks(news, trailingHtml = '') {
    const primaryUrl = news.external_hindi_url || news.external_english_url;
    const buttons = [];

    if (primaryUrl) {
        buttons.push(`<button class="btn btn-secondary btn-xs" onclick="copyReporterArticleLink('${encodeURIComponent(primaryUrl)}')">${icon('copy', 12)} Copy URL</button>`);
    } else {
        buttons.push(`<button class="btn btn-secondary btn-xs btn-disabled" type="button" disabled title="URL is available after publishing">${icon('copy', 12)} URL pending</button>`);
    }

    if (news.external_hindi_url && news.external_english_url) {
        buttons.push(`<button class="btn btn-secondary btn-xs" onclick="copyReporterArticleLink('${encodeURIComponent(news.external_english_url)}')">${icon('copy', 12)} EN URL</button>`);
    }

    return `<div class="news-card-actions-row">${buttons.join('')}${trailingHtml}</div>`;
}

async function copyReporterArticleLink(url) {
    const decodedUrl = decodeURIComponent(url);
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(decodedUrl);
        } else {
            const temp = document.createElement('textarea');
            temp.value = decodedUrl;
            temp.style.position = 'fixed';
            temp.style.left = '-9999px';
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
        }
        showToast('URL copied', 'success');
    } catch (err) {
        showToast(t('common.error'), 'error');
    }
}

/* ── Fake view counter (display-only; computed in the browser,
   never sent to or read from the server) ───────────────────── */

const FAKE_VIEW_SALT = 'cliffnews-fv-v1';
const FAKE_VIEW_MILESTONES = [1000, 5000, 10000, 15000, 20000, 30000, 40000, 50000, 60000, 70000, 100000];
// [bandStartDay, bandEndDay, rangeStart, rangeEnd] -- rangeEnd of null resolves to the
// item's own random terminal cap (95,000-99,999), chosen once per news id.
const FAKE_VIEW_BANDS = [
    [0, 7, 1000, 10000],
    [7, 14, 10000, 30000],
    [14, 21, 30000, 60000],
    [21, 28, 60000, 80000],
    [28, 35, 80000, 90000],
    [35, 42, 90000, null]
];

function fakeViewRandom(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) {
        h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/**
 * Deterministic, monotonically non-decreasing "view count" for a news item.
 * A pure function of (newsId, publishedAt, now) -- nothing is stored, so it
 * can never regress and needs no backend/cron support. Each hour elapsed
 * within the current growth band adds one more random positive increment
 * (seeded by newsId + band + hour index), which is what produces the bursty,
 * never-linear, never-repeating-across-ids growth pattern.
 */
function computeFakeViews(newsId, anchorDateStr) {
    if (!newsId || !anchorDateStr) return 0;
    const anchor = new Date(anchorDateStr).getTime();
    if (Number.isNaN(anchor)) return 0;

    const terminalCap = Math.floor(95000 + fakeViewRandom(`${FAKE_VIEW_SALT}:cap:${newsId}`) * 5000);
    const elapsedDays = Math.max(0, (Date.now() - anchor) / 86400000);

    if (elapsedDays >= 42) return terminalCap;

    let band = FAKE_VIEW_BANDS[0];
    for (const b of FAKE_VIEW_BANDS) {
        if (elapsedDays >= b[0]) band = b;
    }
    const [bandStartDay, bandEndDay, rangeStart, rangeEndRaw] = band;
    const rangeEnd = rangeEndRaw === null ? terminalCap : rangeEndRaw;
    const bandIndex = FAKE_VIEW_BANDS.indexOf(band);

    const totalHoursInBand = (bandEndDay - bandStartDay) * 24;
    const hoursIntoBand = Math.min(totalHoursInBand, Math.max(0, elapsedDays - bandStartDay) * 24);
    const currentHour = Math.floor(hoursIntoBand);

    let cumulative = 0;
    let total = 0;
    for (let hour = 0; hour < totalHoursInBand; hour++) {
        const step = 0.4 + fakeViewRandom(`${FAKE_VIEW_SALT}:h:${newsId}:${bandIndex}:${hour}`);
        total += step;
        if (hour < currentHour) cumulative += step;
    }

    const progress = total > 0 ? cumulative / total : 0;
    return Math.floor(rangeStart + progress * (rangeEnd - rangeStart));
}

function formatFakeViews(n) {
    return n.toLocaleString('en-IN');
}

function fakeViewMilestoneKey(threshold) {
    const uid = getCurrentUser()?.id || 'anon';
    return `fv_ms_${uid}_${threshold}`;
}

/**
 * Milestones are a per-reporter achievement, not a per-article one: once a
 * threshold has been celebrated, it never pops up again for that reporter no
 * matter how many of their approved news items are also above it. Only the
 * single best-performing article (highest current fake view count) is
 * considered, so at most one popup queue is built per threshold.
 */
function checkFakeViewMilestones(newsList) {
    let topNews = null;
    let topViews = -1;
    for (const n of newsList) {
        const anchor = n.published_at || n.forwarded_at || n.processed_at;
        const views = computeFakeViews(n.id, anchor);
        if (views > topViews) {
            topViews = views;
            topNews = n;
        }
    }
    if (!topNews) return;

    const queue = [];
    for (const threshold of FAKE_VIEW_MILESTONES) {
        if (topViews < threshold) break;
        const key = fakeViewMilestoneKey(threshold);
        try {
            if (!localStorage.getItem(key)) {
                queue.push({ headline: topNews.headline_rewritten || topNews.headline, threshold, key });
            }
        } catch { /* localStorage unavailable -- skip milestone popups silently */ }
    }
    if (queue.length) showNextFakeViewMilestone(queue);
}

const MS_BURST_POINTS = '150.0,5.0 174.0,44.7 212.9,19.4 217.3,65.6 263.4,59.6 247.3,103.1 291.4,117.7 258.0,150.0 291.4,182.3 247.3,196.9 263.4,240.4 217.3,234.4 212.9,280.6 174.0,255.3 150.0,295.0 126.0,255.3 87.1,280.6 82.7,234.4 36.6,240.4 52.7,196.9 8.6,182.3 42.0,150.0 8.6,117.7 52.7,103.1 36.6,59.6 82.7,65.6 87.1,19.4 126.0,44.7';

function showNextFakeViewMilestone(queue) {
    const item = queue.shift();
    if (!item) return;

    const isComplete = item.threshold >= 100000;
    const viewsText = formatFakeViews(item.threshold);
    const title = isComplete ? '1 लाख व्यूज पूरे हुए!' : 'माइलस्टोन पूरा हुआ!';
    const text = `आपकी खबर "${escapeHtml(item.headline || '')}" हमारी वेबसाइट, ऐप और सोशल मीडिया हैंडल्स -- Instagram, Facebook, LinkedIn और YouTube -- पर देखी जा रही है। इसे अब तक ${viewsText} व्यूज मिल चुके हैं। इस उपलब्धि के लिए बधाई!`;

    const html = `
        <div class="confirm-overlay ms-overlay" id="fakeViewMilestoneDialog">
            <div class="ms-wrap" onclick="event.stopPropagation()">
                <div class="ms-burst">
                    <span class="ms-star ms-star-1">★</span>
                    <span class="ms-star ms-star-2">★</span>
                    <span class="ms-star ms-star-3">✦</span>
                    <span class="ms-star ms-star-4">★</span>
                    <span class="ms-star ms-star-5">✦</span>
                    <svg class="ms-burst-svg" viewBox="0 0 300 300"><polygon points="${MS_BURST_POINTS}"/></svg>
                    <div class="ms-burst-content">
                        <div class="ms-popper">🎉</div>
                        <div class="ms-burst-title">${title}</div>
                        <div class="ms-burst-text">${text}</div>
                    </div>
                    <div class="ms-views-badge">${viewsText}<br>VIEWS!</div>
                </div>
                <button class="ms-close-btn" id="fakeViewMilestoneCloseBtn">बंद करें</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('fakeViewMilestoneCloseBtn').onclick = () => {
        document.getElementById('fakeViewMilestoneDialog')?.remove();
        try { localStorage.setItem(item.key, '1'); } catch { /* ignore */ }
        showNextFakeViewMilestone(queue);
    };
}

/* ── Approved tab ────────────────────────────────────────── */

function renderReporterApprovedTab() {
    const content = document.getElementById('reporterContent');
    content.innerHTML = `
        <div class="page-header">
            <h2 data-i18n="reporter.approved_news">${t('reporter.approved_news') || 'Approved News'}</h2>
        </div>
        <div id="approvedNewsList">
            <div class="loading-spinner" style="margin: 40px auto;"></div>
        </div>
    `;
    applyLanguage();
    loadReporterApprovedNews();
}

async function loadReporterApprovedNews() {
    const container = document.getElementById('approvedNewsList');
    try {
        const data = await api('/reporter/news/approved');
        if (!data || !data.news || data.news.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-svg">${icon('check-circle', 40)}</div>
                    <div class="empty-text" data-i18n="reporter.no_approved">${t('reporter.no_approved') || 'No approved news yet'}</div>
                </div>
            `;
            applyLanguage();
            return;
        }

        container.innerHTML = data.news.map(n => {
            const fakeViews = computeFakeViews(n.id, n.published_at || n.forwarded_at || n.processed_at);
            return `
            <div class="card news-card">
                <div class="news-card-header">
                    ${n.image_path
                        ? `<img class="news-card-thumb" src="${n.image_path}" alt="" onerror="this.style.display='none'">`
                        : `<div class="news-card-thumb-placeholder">${icon('newspaper', 22)}</div>`
                    }
                    <div class="news-card-info">
                        <div class="news-card-headline"><span style="color:var(--accent-orange);margin-right:6px;">#${n.id}</span>${escapeHtml(n.headline_rewritten || n.headline)}</div>
                    </div>
                </div>
                <div class="news-card-meta">
                    <span class="status-badge ${n.status}">${t('editor.status_' + n.status) || n.status.toUpperCase()}</span>
                    <span class="news-card-meta-item">${icon('folder', 12)} ${n.category}</span>
                    ${n.city ? `<span class="news-card-meta-item">${icon('pin', 12)} ${n.city}</span>` : ''}
                    <span class="news-card-meta-item">${icon('clock', 12)} ${formatDate(n.published_at || n.forwarded_at || n.processed_at)}</span>
                </div>
                ${renderReporterExternalLinks(n, `<span class="news-card-meta-item fake-view-badge">${icon('eye', 12)} ${formatFakeViews(fakeViews)} व्यूज</span>`)}
            </div>
        `;
        }).join('');

        checkFakeViewMilestones(data.news);
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

/* ── Rejected tab ────────────────────────────────────────── */

function renderReporterRejectedTab() {
    const content = document.getElementById('reporterContent');
    content.innerHTML = `
        <div class="page-header">
            <h2 data-i18n="reporter.rejected_news">${t('reporter.rejected_news') || 'Rejected News'}</h2>
        </div>
        <div id="rejectedNewsList">
            <div class="loading-spinner" style="margin: 40px auto;"></div>
        </div>
    `;
    applyLanguage();
    loadReporterRejectedNews();
}

async function loadReporterRejectedNews() {
    const container = document.getElementById('rejectedNewsList');
    try {
        const data = await api('/reporter/news/rejected');
        if (!data || !data.news || data.news.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-svg">${icon('x-circle', 40)}</div>
                    <div class="empty-text" data-i18n="reporter.no_rejected">${t('reporter.no_rejected') || 'No rejected news'}</div>
                </div>
            `;
            applyLanguage();
            return;
        }

        container.innerHTML = data.news.map(n => `
            <div class="card news-card">
                <div class="news-card-info" style="width: 100%;">
                    <div class="news-card-headline" style="color: #64748b; text-decoration: line-through;"><span style="color:var(--accent-orange);margin-right:6px;text-decoration:none;">#${n.id}</span>${escapeHtml(n.headline)}</div>
                    <div class="news-card-body" style="color: #dc2626; font-size: 0.85rem; margin-top: 6px;">
                        <strong>Rejected by ${escapeHtml(n.rejected_by_name)}:</strong> ${escapeHtml(n.reject_reason || 'No reason provided')}
                    </div>
                </div>
                <div class="news-card-meta" style="margin-top: 12px;">
                    <span class="status-badge" style="background: #fee2e2; color: #b91c1c;">${t('editor.status_rejected')}</span>
                    <span class="news-card-meta-item">${icon('folder', 12)} ${n.category}</span>
                    <span class="news-card-meta-item">${icon('clock', 12)} ${formatDate(n.rejected_at)}</span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('common.error')}</div></div>`;
    }
}

function renderReporterPdfsTab() {
    const content = document.getElementById('reporterContent');
    content.innerHTML = `
        <div class="page-header">
            <h2>जनरेटेड PDFs</h2>
            <p>API द्वारा जनरेट की गई आपकी PDF फाइलें</p>
        </div>
        <div id="reporterPdfsList">
            <div class="loading-spinner" style="margin: 40px auto;"></div>
        </div>
    `;
    applyLanguage();
    loadReporterPdfs();
}

async function loadReporterPdfs() {
    const container = document.getElementById('reporterPdfsList');
    try {
        const data = await api('/webhook/my-pdfs');
        const pdfs = data.pdfs || [];
        
        if (pdfs.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-text">कोई PDF उपलब्ध नहीं है</div></div>`;
            return;
        }

        container.innerHTML = pdfs.map(pdf => {
            const dateStr = new Date(pdf.created_at).toLocaleString('hi-IN');
            return `
                <div class="card" style="padding: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 16px;">
                    <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; color: var(--accent-orange);">
                        ${icon('file', 32)}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 1.05rem; color: var(--text-primary); word-break: break-all;">
                            <a href="${pdf.pdf_url}" target="_blank" style="text-decoration:none; color:inherit;">${escapeHtml(pdf.filename || 'newspaper.pdf')}</a>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 6px;">${dateStr}</div>
                    </div>
                    <a href="${pdf.pdf_url}" download class="btn btn-secondary btn-sm" style="display:flex; align-items:center; gap:6px;">
                        ${icon('download', 16)} डाउनलोड
                    </a>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><div class="empty-text">Error loading PDFs</div></div>`;
    }
}
