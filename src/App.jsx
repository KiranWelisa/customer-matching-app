import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Building2, Target, TrendingUp, Users, DollarSign, Settings, Lightbulb, Upload, FileText, X, CheckCircle, Brain, Zap, BarChart3, Globe, Sparkles, AlertCircle, Download, RefreshCw, Award, ArrowRight, Activity, Shield, Rocket, ChevronRight, Loader2, Eye, EyeOff, Star, Flame, Clock, TrendingDown, CheckCircle2 } from 'lucide-react';

// Main component for the Customer Matching Application
const App = () => {
  // State variables to manage the application's data and UI
  const [customerData, setCustomerData] = useState([]);
  const [inputDescription, setInputDescription] = useState('');
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [useAI, setUseAI] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('none');
  const [uploadError, setUploadError] = useState('');
  const [matchingProgress, setMatchingProgress] = useState(0);
  const [aiConfidence, setAiConfidence] = useState(null);
  const [matchHistory, setMatchHistory] = useState([]);
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState(null);
  const [liveTyping, setLiveTyping] = useState(false);
  const [aiValidationStatus, setAiValidationStatus] = useState('');
  const [searchIteration, setSearchIteration] = useState(0);
  const [searchStatus, setSearchStatus] = useState({
    stage: '',
    message: '',
    isImproving: false,
    totalStages: 0,
    currentStage: 0,
    lowQualityWarning: false
  });
  const [industryInsights, setIndustryInsights] = useState(null);

  // Function to call our own secure API route
  const callGeminiAPI = async (prompt, timeoutMs) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // This fetch call points to our own serverless function located in /api/gemini.js
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }), // Send the prompt in the request body
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('API route request failed:', response.status, 'and body:', errorBody);
        return null;
      }
      
      // The serverless function already parses the JSON from Gemini,
      // so we can use the response directly.
      return await response.json();

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error calling our API route:', error);
      if (error.name === 'AbortError') {
        console.error('API call timed out after', timeoutMs, 'ms');
      }
      return null;
    }
  };

  // Enhanced similarity calculation with semantic understanding
  const calculateSimilarity = useCallback((text1, text2, fieldName = '') => {
    if (!text1 || !text2) return 0;
    
    const normalize = (text) => text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const normalizedText1 = normalize(text1);
    const normalizedText2 = normalize(text2);
    
    if (fieldName === 'sector' && normalizedText1 && normalizedText2) {
      console.log(`Comparing ${fieldName}: "${normalizedText1}" vs "${normalizedText2}"`);
    }
    
    if (normalizedText1 === normalizedText2) return 1.0;
    if (normalizedText1.includes(normalizedText2) || normalizedText2.includes(normalizedText1)) {
      return 0.85;
    }
    
    const semanticGroups = [
      ['transport', 'logistiek', 'logistics', 'shipping', 'maritiem', 'maritime', 'cargo', 'freight', 'scheepvaart'],
      ['handel', 'trading', 'trade', 'handelsbemiddeling', 'broker', 'intermediary'],
      ['software', 'it', 'technology', 'tech', 'digital', 'automation', 'saas', 'platform'],
      ['manufacturing', 'production', 'productie', 'fabricage', 'industrie', 'industrial'],
      ['bouw', 'construction', 'building', 'contractors', 'aannemers'],
      ['diensten', 'services', 'dienstverlening', 'consultancy', 'advies'],
      ['retail', 'detailhandel', 'wholesale', 'groothandel', 'distribution'],
      ['finance', 'financial', 'banking', 'insurance', 'verzekering', 'fintech'],
      ['healthcare', 'medical', 'medisch', 'zorg', 'gezondheid', 'pharma'],
      ['energy', 'energie', 'utilities', 'power', 'sustainable', 'duurzaam', 'renewable']
    ];
    
    let semanticMatch = 0;
    for (const group of semanticGroups) {
      const text1InGroup = group.some(term => normalizedText1.includes(term));
      const text2InGroup = group.some(term => normalizedText2.includes(term));
      
      if (text1InGroup && text2InGroup) {
        semanticMatch = 0.7;
        break;
      } else if (text1InGroup || text2InGroup) {
        const incompatiblePairs = [
          ['transport', 'handel'],
          ['software', 'manufacturing'],
          ['retail', 'finance'],
          ['construction', 'healthcare']
        ];
        
        for (const [sector1, sector2] of incompatiblePairs) {
          if ((normalizedText1.includes(sector1) && normalizedText2.includes(sector2)) ||
              (normalizedText1.includes(sector2) && normalizedText2.includes(sector1))) {
            return 0.1;
          }
        }
      }
    }
    
    const words1 = normalizedText1.split(' ').filter(word => word.length > 2);
    const words2 = normalizedText2.split(' ').filter(word => word.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return semanticMatch;
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    const jaccardIndex = intersection.size / union.size;
    const wordScore = jaccardIndex * 0.5;
    
    return Math.min(1.0, Math.max(semanticMatch, wordScore));
  }, []);

  // Basic functions for matching
  const matchDealSize = (inputSize, customerSize) => {
    if (!inputSize || !customerSize || 
        customerSize === 'Niet beschikbaar' || 
        customerSize === 'Not available' ||
        customerSize === 'N/A') return 0.5;
    
    const sizeMap = {
      'klein': 1, 'small': 1,
      'mkb': 2, 'sme': 2, 'middel': 2, 'medium': 2,
      'groot': 3, 'large': 3,
      'enterprise': 4, 'multinational': 4,
      'nederlandse bedrijven': 2, 'dutch companies': 2
    };
    
    const extractSize = (text) => {
      const normalized = text.toLowerCase();
      for (const [key, value] of Object.entries(sizeMap)) {
        if (normalized.includes(key)) return value;
      }
      
      const matches = text.match(/€?\s*(\d+(?:[,\.]\d+)*)\s*([kmb]?)/gi);
      if (!matches) return null;
      
      let amount = parseFloat(matches[0].replace(/[€,]/g, '').replace(/k/gi, '000').replace(/m/gi, '000000').replace(/b/gi, '000000000'));
      
      if (amount < 50000) return 1;
      if (amount < 500000) return 2;
      if (amount < 5000000) return 3;
      return 4;
    };
    
    const inputSizeValue = extractSize(inputSize);
    const customerSizeValue = extractSize(customerSize);
    
    if (!inputSizeValue || !customerSizeValue) return 0.5;
    
    const sizeDiff = Math.abs(inputSizeValue - customerSizeValue);
    if (sizeDiff === 0) return 1.0;
    if (sizeDiff === 1) return 0.7;
    if (sizeDiff === 2) return 0.4;
    return 0.2;
  };

  const extractKeyInfo = useCallback((description) => {
    const info = {
      sector: '', products: '', salesModel: '', serviceModel: '',
      customerProfile: '', dealSize: '', businessModel: '', kernactiviteit: '',
      tenderInvolved: false, dealerDriven: false, engineerToOrder: false,
      configureToOrder: false, keywords: []
    };

    const text = description.toLowerCase();
    const lines = description.split('\n');
    
    const sectorKeywords = {
      'transport': ['transport', 'logistiek', 'logistics', 'shipping', 'maritiem', 'maritime', 'cargo', 'freight', 'scheepvaart', 'short sea', 'deep sea'],
      'handel': ['handel', 'trading', 'trade', 'handelsbemiddeling', 'broker', 'groothandel', 'wholesale', 'retail'],
      'software': ['software', 'it', 'technology', 'tech', 'digital', 'automation', 'saas', 'platform', 'applicatie'],
      'manufacturing': ['manufacturing', 'production', 'productie', 'fabricage', 'industrie', 'industrial', 'fabriek'],
      'construction': ['bouw', 'construction', 'building', 'contractors', 'aannemers', 'infrastructuur'],
      'services': ['diensten', 'services', 'dienstverlening', 'consultancy', 'advies', 'consulting'],
      'finance': ['finance', 'financial', 'banking', 'insurance', 'verzekering', 'fintech', 'bank'],
      'healthcare': ['healthcare', 'medical', 'medisch', 'zorg', 'gezondheid', 'pharma', 'farmaceutisch']
    };
    
    for (const [sector, keywords] of Object.entries(sectorKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        info.sector = sector;
        break;
      }
    }
    
    lines.forEach(line => {
      const lower = line.toLowerCase().trim();
      
      if (lower.includes('kernactiviteit:') || lower.includes('core activity:') || lower.includes('activiteit:')) {
        info.kernactiviteit = line.substring(line.indexOf(':') + 1).trim();
      }
      
      if (lower.includes('sector:') || lower.includes('industrie:') || lower.includes('industry:')) {
        const sectorLine = line.substring(line.indexOf(':') + 1).trim();
        if (!info.sector) info.sector = sectorLine;
      }
      
      if (lower.includes('producten') || lower.includes('diensten') || lower.includes('products') || lower.includes('services')) {
        if (line.includes(':')) info.products += ' ' + line.substring(line.indexOf(':') + 1).trim();
      }
      
      if (lower.includes('verkoop') || lower.includes('sales') || lower.includes('verkoopmodel')) {
        const salesLine = line.substring(line.indexOf(':') + 1).trim();
        info.salesModel = salesLine;
        if (lower.includes('dealer') || lower.includes('indirect') || lower.includes('partner')) info.dealerDriven = true;
        if (lower.includes('b2b')) info.salesModel = 'B2B';
        if (lower.includes('b2c')) info.salesModel = 'B2C';
      }
      
      if (lower.includes('tender') || lower.includes('aanbesteding')) info.tenderInvolved = true;
      if (lower.includes('klanten:') || lower.includes('customers:') || lower.includes('doelgroep:')) info.customerProfile = line.substring(line.indexOf(':') + 1).trim();
      if (lower.includes('deal') || lower.includes('omvang') || lower.includes('grootte')) info.dealSize = line.substring(line.indexOf(':') + 1).trim();
    });
    
    if (!info.kernactiviteit && text.includes('internationale') && text.includes('maritieme')) info.kernactiviteit = 'internationale maritieme dienstverlening';
    if (text.includes('engineer-to-order') || text.includes('eto')) info.engineerToOrder = true;
    if (text.includes('configure-to-order') || text.includes('cto')) info.configureToOrder = true;
    
    const criticalKeywords = text.match(/\b(b2b|b2c|dealer|tender|aanbesteding|maatwerk|eto|cto|field service|maintenance|manufacturing|automotive|healthcare|fintech|iot|ai|automation|digital|maritiem|maritime|transport|logistiek|logistics|shipping|cargo|freight|international|internationaal|scheepvaart|short sea|deep sea)\b/g) || [];
    info.keywords = [...new Set(criticalKeywords)];
    
    Object.keys(info).forEach(key => {
      if (typeof info[key] === 'string') info[key] = info[key].trim();
    });
    
    return info;
  }, []);

  // AI Analysis function using Gemini
  const performAIAnalysis = async (description) => {
    const timeoutMs = 15000;
    setIsAnalyzing(true);

    const prompt = `Analyze this company description for BDR matching. Extract key business characteristics:

${description}

Respond with ONLY valid JSON:
{
  "sector": "primary industry",
  "kernactiviteit": "core business activity",
  "products": "main products/services",
  "salesModel": "sales approach",
  "serviceModel": "service delivery",
  "customerProfile": "target customers",
  "dealerDriven": true/false,
  "tenderInvolved": true/false,
  "engineerToOrder": true/false,
  "configureToOrder": true/false,
  "dealSize": "deal size range",
  "businessComplexity": "low/medium/high",
  "keyStrengths": ["strength1", "strength2", "strength3"],
  "industryKeywords": ["keyword1", "keyword2", "keyword3"],
  "competitivePosition": "market position",
  "confidence": 0.85
}`;

    const result = await callGeminiAPI(prompt, timeoutMs);
    setIsAnalyzing(false);

    if (!result) {
      console.error('AI analysis failed or timed out.');
      setSearchStatus(prev => ({
        ...prev,
        message: 'AI analysis timed out, continuing with basic matching...'
      }));
    }
    
    return result;
  };

  // AI Scoring function using Gemini
  const getAIScore = async (inputAnalysis, customer) => {
    const timeoutMs = 10000;
    const prompt = `Analyze the match between this prospect and customer:

PROSPECT:
${JSON.stringify(inputAnalysis, null, 2)}

CUSTOMER:
Company: ${customer.Bedrijf}
Sector: ${customer.Sector}
Core Activity: ${customer.Kernactiviteit}
Products: ${customer['Producten/Diensten']}
Sales Model: ${customer.Verkoopmodel}
Service Model: ${customer.Servicemodel}

Respond with ONLY valid JSON:
{
  "overallSimilarity": 0.85,
  "sectorMatch": 0.90,
  "activityMatch": 0.75,
  "salesModelMatch": 0.80,
  "strategicFit": "high/medium/low",
  "keyReasons": ["reason1", "reason2"],
  "conversionProbability": "high/medium/low",
  "salesInsight": "key insight for BDR"
}`;

    const result = await callGeminiAPI(prompt, timeoutMs);
    if (!result) {
      console.error('AI scoring failed for', customer.Bedrijf);
    }
    return result;
  };

  // Generate improved search terms with AI using Gemini
  const generateImprovedSearchTerms = async (originalDescription, poorMatches) => {
    const timeoutMs = 10000;
    const prompt = `The following company description yielded poor matches:

${originalDescription}

Poor matches were:
${poorMatches.map(m => `- ${m.Bedrijf} (${m.Sector})`).join('\n')}

Generate alternative search terms and characteristics that might find better matches. Focus on:
1. Alternative industry sectors this company might match with
2. Different ways to describe their core activities
3. Related business models or service approaches

Respond with ONLY valid JSON:
{
  "alternativeSectors": ["sector1", "sector2"],
  "alternativeActivities": ["activity1", "activity2"],
  "relatedKeywords": ["keyword1", "keyword2", "keyword3"],
  "expandedSearch": "broader description for matching"
}`;

    const result = await callGeminiAPI(prompt, timeoutMs);
    if (!result) {
      console.error('Search term generation failed or timed out.');
    }
    return result;
  };

  // Explanation generator
  const generateExplanation = (scores, customer, inputInfo, aiInsight) => {
    const parts = [];
    
    if (aiInsight) {
      if (aiInsight.strategicFit === 'high') parts.push(`🌟 ${aiInsight.strategicFit.toUpperCase()} Strategic Fit`);
      if (aiInsight.keyReasons && aiInsight.keyReasons.length > 0) parts.push(aiInsight.keyReasons[0]);
    }
    
    if (scores.sector < 0.3) parts.push(`Sector mismatch - ${inputInfo.sector || 'your industry'} vs ${customer.Sector}`);
    else if (scores.sector > 0.6) parts.push(`Strong sector alignment in ${customer.Sector}`);
    
    if (scores.kernactiviteit > 0.6) parts.push(`Core activity alignment: ${customer.Kernactiviteit}`);
    else if (scores.kernactiviteit < 0.3) parts.push(`Different core activities`);
    
    if (scores.salesModel > 0.8) parts.push(`Matching sales model: ${customer.Verkoopmodel}`);
    if (inputInfo.dealerDriven && customer.Verkoopmodel.toLowerCase().includes('dealer')) parts.push(`🤝 Dealer network match`);
    if (inputInfo.tenderInvolved && customer.Kernproces && customer.Kernproces.toLowerCase().includes('tender')) parts.push(`📋 Tender process experience`);
    
    if (parts.length === 0) {
      if (scores.sector < 0.3 && scores.kernactiviteit < 0.3) parts.push('Minimal overlap in sector and activities');
      else parts.push('Limited business alignment');
    }
    
    return parts.join(' • ') || 'Business alignment identified';
  };

  // Main matching function with iterative AI validation
  const findMatches = async () => {
    if (!inputDescription.trim() || customerData.length === 0) {
      setMatches([]);
      return;
    }

    setIsLoading(true);
    setMatchingProgress(0);
    setAiAnalysis(null);
    setSearchIteration(0);
    setSearchStatus({
      stage: 'basic',
      message: 'Running initial search...',
      isImproving: false,
      totalStages: useAI ? 4 : 1,
      currentStage: 1,
      lowQualityWarning: false
    });
    
    let currentDescription = inputDescription;
    let iterationCount = 0;
    const maxIterations = 3;
    let aiAnalysisResult = null;
    let topMatches = [];
    
    let hasTimedOut = false;
    let hasError = false;
    const globalTimeout = setTimeout(() => {
      console.error('Global AI timeout reached, completing with current results');
      hasTimedOut = true;
      if (matches.length === 0 && topMatches.length > 0) setMatches(topMatches);
      setSearchStatus(prev => ({
        ...prev,
        stage: 'timeout',
        message: 'AI processing timed out - showing available results'
      }));
    }, 60000);
    
    try {
      // Step 1: Basic search
      const inputInfo = extractKeyInfo(currentDescription);
      console.log('Extracted input info:', inputInfo);
      setMatchingProgress(20);
      
      const scoredCustomers = customerData.map(customer => {
        const scores = {
          sector: calculateSimilarity(inputInfo.sector, customer.Sector, 'sector'),
          kernactiviteit: calculateSimilarity(inputInfo.kernactiviteit, customer.Kernactiviteit, 'kernactiviteit'),
          products: calculateSimilarity(inputInfo.products, customer['Producten/Diensten'], 'products'),
          salesModel: calculateSimilarity(inputInfo.salesModel, customer.Verkoopmodel, 'salesModel'),
          serviceModel: calculateSimilarity(inputInfo.serviceModel, customer.Servicemodel, 'serviceModel'),
          customerProfile: calculateSimilarity(inputInfo.customerProfile, customer.Klantprofiel, 'customerProfile'),
          dealSize: matchDealSize(inputInfo.dealSize, customer.Dealsize)
        };

        let bonusScore = 0;
        if (inputInfo.dealerDriven && customer.Verkoopmodel && customer.Verkoopmodel.toLowerCase().includes('dealer')) bonusScore += 0.15;
        if (inputInfo.tenderInvolved && customer.Kernproces && customer.Kernproces.toLowerCase().includes('tender')) bonusScore += 0.12;
        if (inputInfo.engineerToOrder && customer.Kernproces && customer.Kernproces.toLowerCase().includes('engineer')) bonusScore += 0.10;

        const weights = {
          sector: 0.35, kernactiviteit: 0.30, serviceModel: 0.10, products: 0.10,
          salesModel: 0.08, customerProfile: 0.05, dealSize: 0.02
        };

        const traditionalScore = Object.entries(scores).reduce((sum, [key, score]) => sum + (score * (weights[key] || 0)), 0) + bonusScore;

        return { ...customer, scores, bonusScore, totalScore: Math.min(1.0, traditionalScore), inputInfo };
      });
      
      console.log('Top 5 scored customers:', scoredCustomers
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 5)
        .map(c => ({ name: c.Bedrijf, sector: c.Sector, score: `${Math.round(c.totalScore * 100)}%`, scores: Object.entries(c.scores).map(([k, v]) => `${k}: ${Math.round(v * 100)}%`).join(', ') }))
      );

      const minThreshold = 0.3;
      topMatches = scoredCustomers
        .filter(customer => customer.totalScore >= minThreshold)
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 5)
        .map(match => ({ ...match, explanation: generateExplanation(match.scores, match, inputInfo, null) }));

      if (topMatches.length < 3) {
        const belowThreshold = scoredCustomers
          .filter(customer => customer.totalScore < minThreshold)
          .sort((a, b) => b.totalScore - a.totalScore)
          .slice(0, 3 - topMatches.length)
          .map(match => ({ ...match, explanation: '⚠️ Low match score - ' + generateExplanation(match.scores, match, inputInfo, null), isBelowThreshold: true }));
        topMatches = [...topMatches, ...belowThreshold];
      }

      if (topMatches.length === 0) {
        console.error('No matches found even below threshold');
        clearTimeout(globalTimeout);
        setSearchStatus({ stage: 'complete', message: 'No suitable matches found', isImproving: false, totalStages: 1, currentStage: 1, lowQualityWarning: false });
        setMatchingProgress(100);
        setTimeout(() => { setIsLoading(false); setMatchingProgress(0); setSearchStatus({ stage: '', message: '', isImproving: false, totalStages: 0, currentStage: 0, lowQualityWarning: false }); }, 2000);
        return;
      }

      setMatches(topMatches);
      setMatchingProgress(30);
      
      if (topMatches.length > 0 && topMatches[0].totalScore < 0.5) {
        console.warn('Warning: All matches have low scores. Best match is only', `${Math.round(topMatches[0].totalScore * 100)}%`);
        setSearchStatus(prev => ({ ...prev, lowQualityWarning: true }));
      }

      if (!useAI) {
        clearTimeout(globalTimeout);
        setSearchStatus({ stage: 'complete', message: 'Search complete', isImproving: false, totalStages: 1, currentStage: 1, lowQualityWarning: topMatches.length > 0 && topMatches[0].totalScore < 0.5 });
        setMatchingProgress(100);
        setTimeout(() => { setIsLoading(false); setMatchingProgress(0); setSearchStatus({ stage: '', message: '', isImproving: false, totalStages: 0, currentStage: 0, lowQualityWarning: false }); }, 2000);
        return;
      }

      // Step 2: AI Analysis
      setSearchStatus({ stage: 'ai-analysis', message: 'AI analyzing your company description...', isImproving: true, totalStages: 4, currentStage: 2, lowQualityWarning: false });
      
      aiAnalysisResult = await performAIAnalysis(inputDescription);
      
      if (!aiAnalysisResult) {
        console.warn('AI analysis failed, continuing with traditional matching only');
        setSearchStatus(prev => ({ ...prev, message: 'AI analysis unavailable, using traditional matching...', stage: 'fallback' }));
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        setAiAnalysis(aiAnalysisResult);
        setAiConfidence(aiAnalysisResult.confidence || 0.8);
      }
      
      setMatchingProgress(40);

      // Iterative improvement loop
      while (iterationCount < maxIterations && !hasTimedOut && !hasError) {
        iterationCount++;
        setSearchIteration(iterationCount);
        
        if (hasTimedOut) {
          console.log('Breaking iteration loop due to timeout');
          break;
        }
        
        setSearchStatus({ stage: 'ai-validation', message: `AI validating matches (iteration ${iterationCount}${iterationCount > 1 ? ' - improving results' : ''})...`, isImproving: true, totalStages: 4, currentStage: 3, lowQualityWarning: false });
        setMatchingProgress(50 + (iterationCount - 1) * 10);

        if (aiAnalysisResult) {
          const aiScoringPromises = topMatches.map(async (match, index) => {
            try {
              await new Promise(resolve => setTimeout(resolve, index * 100));
              const aiScoring = await getAIScore(aiAnalysisResult, match);
              if (aiScoring) {
                const blendedScore = (aiScoring.overallSimilarity * 0.5) + (match.totalScore * 0.5);
                return { ...match, aiScore: aiScoring.overallSimilarity, totalScore: Math.min(1.0, blendedScore), aiInsight: aiScoring, explanation: generateExplanation(match.scores, match, inputInfo, aiScoring) };
              }
              console.warn('AI scoring failed for', match.Bedrijf, ', keeping traditional score');
              return match;
            } catch (error) {
              console.error('Error in AI scoring for', match.Bedrijf, ':', error);
              return match;
            }
          });

          const aiEnhancedMatches = await Promise.all(aiScoringPromises);
          const aiSuccessCount = aiEnhancedMatches.filter(m => m.aiScore !== undefined).length;
          console.log(`AI scoring completed: ${aiSuccessCount}/${topMatches.length} successful`);
          
          aiEnhancedMatches.sort((a, b) => b.totalScore - a.totalScore);
          setMatches([...aiEnhancedMatches]);
          setMatchingProgress(60 + (iterationCount - 1) * 10);
          
          if (aiSuccessCount >= 3) {
            const top3AiScores = aiEnhancedMatches.slice(0, 3).map(m => m.aiScore || 0);
            const hasLowQualityMatch = top3AiScores.some(score => score < 0.4);
            
            if (hasLowQualityMatch && iterationCount < maxIterations) {
              setSearchStatus({ stage: 'improving', message: 'AI detected suboptimal matches, enhancing search criteria...', isImproving: true, totalStages: 4, currentStage: 4, lowQualityWarning: false });
              setMatchingProgress(70 + (iterationCount - 1) * 10);
              
              const improvedTerms = await generateImprovedSearchTerms(inputDescription, aiEnhancedMatches.slice(0, 3));
              
              if (improvedTerms) {
                currentDescription = `${inputDescription}\n\nAlternative sectors: ${improvedTerms.alternativeSectors.join(', ')}\nRelated activities: ${improvedTerms.alternativeActivities.join(', ')}\nKeywords: ${improvedTerms.relatedKeywords.join(', ')}\n${improvedTerms.expandedSearch}`;
                const enhancedInputInfo = extractKeyInfo(currentDescription);
                
                const reScored = customerData.map(customer => {
                  const scores = {
                    sector: calculateSimilarity(enhancedInputInfo.sector, customer.Sector, 'sector'),
                    kernactiviteit: calculateSimilarity(enhancedInputInfo.kernactiviteit, customer.Kernactiviteit, 'kernactiviteit'),
                    products: calculateSimilarity(enhancedInputInfo.products, customer['Producten/Diensten'], 'products'),
                    salesModel: calculateSimilarity(enhancedInputInfo.salesModel, customer.Verkoopmodel, 'salesModel'),
                    serviceModel: calculateSimilarity(enhancedInputInfo.serviceModel, customer.Servicemodel, 'serviceModel'),
                    customerProfile: calculateSimilarity(enhancedInputInfo.customerProfile, customer.Klantprofiel, 'customerProfile'),
                    dealSize: matchDealSize(enhancedInputInfo.dealSize, customer.Dealsize)
                  };
                  let bonusScore = 0;
                  if (enhancedInputInfo.dealerDriven && customer.Verkoopmodel && customer.Verkoopmodel.toLowerCase().includes('dealer')) bonusScore += 0.15;
                  if (enhancedInputInfo.tenderInvolved && customer.Kernproces && customer.Kernproces.toLowerCase().includes('tender')) bonusScore += 0.12;
                  const weights = { sector: 0.35, kernactiviteit: 0.30, serviceModel: 0.10, products: 0.10, salesModel: 0.08, customerProfile: 0.05, dealSize: 0.02 };
                  const score = Object.entries(scores).reduce((sum, [key, score]) => sum + (score * (weights[key] || 0)), 0) + bonusScore;
                  return { ...customer, scores, bonusScore, totalScore: Math.min(1.0, score), inputInfo: enhancedInputInfo };
                });

                topMatches = reScored
                  .filter(customer => customer.totalScore >= minThreshold)
                  .sort((a, b) => b.totalScore - a.totalScore)
                  .slice(0, 5)
                  .map(match => ({ ...match, explanation: generateExplanation(match.scores, match, match.inputInfo, null) }));
                
                if (topMatches.length < 3) {
                  const belowThreshold = reScored
                    .filter(customer => customer.totalScore < minThreshold)
                    .sort((a, b) => b.totalScore - a.totalScore)
                    .slice(0, 3 - topMatches.length)
                    .map(match => ({ ...match, explanation: '⚠️ Low match score - ' + generateExplanation(match.scores, match, match.inputInfo, null), isBelowThreshold: true }));
                  topMatches = [...topMatches, ...belowThreshold];
                }
                
                setMatches([...topMatches]);
                continue;
              } else {
                console.warn('Failed to generate improved search terms, ending iteration');
                break;
              }
            }
          } else {
            console.warn('Not enough AI scores to determine if improvement is needed');
          }
          break;
        } else {
          console.error('AI analysis failed, using traditional matching only');
          break;
        }
      }

      if (topMatches.length > 0 && topMatches[0].totalScore > 0.7) {
        setMatchHistory(prev => [...prev, { timestamp: Date.now(), pattern: `iterations:${iterationCount}`, score: topMatches[0].totalScore }].slice(-20));
      }

    } catch (error) {
      console.error('Search error:', error);
      hasError = true;
      if (topMatches && topMatches.length > 0) setMatches(topMatches);
      setSearchStatus({ stage: 'error', message: 'Search encountered an error but completed with available results', isImproving: false, totalStages: 4, currentStage: 4, lowQualityWarning: false });
    } finally {
      clearTimeout(globalTimeout);
      const finalMessage = hasError ? 'Search completed with errors' : hasTimedOut ? 'Search completed (AI timeout)' : useAI && iterationCount > 0 ? `Search optimized via ${iterationCount} iteration${iterationCount > 1 ? 's' : ''}` : 'Search complete';
      setSearchStatus(prev => ({ stage: 'complete', message: finalMessage, isImproving: false, totalStages: 4, currentStage: 4, lowQualityWarning: prev.lowQualityWarning || false }));
      setMatchingProgress(100);
      setTimeout(() => {
        setMatchingProgress(0);
        setIsLoading(false);
        setSearchIteration(0);
        setIsAnalyzing(false);
        setSearchStatus({ stage: '', message: '', isImproving: false, totalStages: 0, currentStage: 0, lowQualityWarning: false });
      }, 2000);
    }
  };

  // File handling with drag and drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileUpload({ target: { files: e.dataTransfer.files } });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Please upload a CSV file');
      setUploadStatus('error');
      return;
    }

    setUploadStatus('uploading');
    setUploadError('');
    
    try {
      const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });

      const firstLine = fileContent.split('\n')[0];
      let delimiter = ',';
      const delimiters = [',', ';', '\t', '|'];
      let maxCount = 0;
      
      delimiters.forEach(del => {
        const count = (firstLine.match(new RegExp(`\\${del}`, 'g')) || []).length;
        if (count > maxCount) {
          maxCount = count;
          delimiter = del;
        }
      });
      console.log(`Detected delimiter: "${delimiter}"`);

      const lines = fileContent.split('\n').filter(line => line.trim());
      if (lines.length < 2) throw new Error('CSV file must have at least a header row and one data row');

      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '').trim().replace(/^\uFEFF/, ''));
      console.log('Headers found:', headers);
      
      const validHeaders = headers.filter(h => h && !h.match(/^Column \d+$/));
      const requiredHeaders = ['Bedrijf', 'Kernactiviteit', 'Sector'];
      const foundHeaders = validHeaders.filter(h => requiredHeaders.includes(h));
      
      if (foundHeaders.length < requiredHeaders.length) {
        const missing = requiredHeaders.filter(h => !foundHeaders.includes(h));
        throw new Error(`Missing required columns: ${missing.join(', ')}. Found columns: ${validHeaders.join(', ')}`);
      }

      const data = [];
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, '').trim());
          const customer = {};
          headers.forEach((header, index) => {
            if (header && !header.match(/^Column \d+$/) && values[index] !== undefined) {
              customer[header] = values[index] || '';
            }
          });
          if (customer.Bedrijf && customer.Bedrijf.trim()) data.push(customer);
        }
      }
      
      if (data.length === 0) throw new Error('No valid customer data found in the CSV file');

      console.log(`Successfully loaded ${data.length} customers`);
      setCustomerData(data);
      setUploadedFile(file);
      setUploadStatus('success');
      
      setTimeout(() => setUploadStatus('none'), 3000);
      
    } catch (error) {
      console.error('Error processing CSV file:', error);
      setUploadError(error.message);
      setUploadStatus('error');
      setCustomerData([]);
    }
  };

  const clearUploadedData = () => {
    setCustomerData([]);
    setUploadedFile(null);
    setUploadStatus('none');
    setUploadError('');
    setMatches([]);
    setAiAnalysis(null);
    setAiConfidence(null);
    setSearchIteration(0);
    setSearchStatus({ stage: '', message: '', isImproving: false, totalStages: 0, currentStage: 0, lowQualityWarning: false });
    setIndustryInsights(null);
    setIsAnalyzing(false);
  };

  const exportMatches = () => {
    if (!matches || matches.length === 0) return;
    
    const exportData = matches.map((match, index) => ({
      Rank: index + 1,
      Company: match.Bedrijf,
      Score: `${Math.round(match.totalScore * 100)}%`,
      Sector: match.Sector,
      CoreActivity: match.Kernactiviteit,
      SalesModel: match.Verkoopmodel,
      ServiceModel: match.Servicemodel,
      DealSize: match.Dealsize,
      StrategicFit: match.aiInsight?.strategicFit || 'N/A',
      ConversionProbability: match.aiInsight?.conversionProbability || 'N/A',
      KeyInsights: match.explanation
    }));
    
    const csv = [
      Object.keys(exportData[0]).join(','),
      ...exportData.map(row => Object.values(row).map(v => `"${v}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matches_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const timeout = setTimeout(() => setLiveTyping(false), 1000);
    if (inputDescription.trim()) setLiveTyping(true);
    return () => clearTimeout(timeout);
  }, [inputDescription]);

  const filteredCustomers = customerData.filter(customer =>
    (customer.Bedrijf && customer.Bedrijf.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.Sector && customer.Sector.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.Kernactiviteit && customer.Kernactiviteit.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <div className="bg-white/80 backdrop-blur-lg shadow-lg sticky top-0 z-50 border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg blur-lg opacity-75 animate-pulse"></div>
                <div className="relative bg-white rounded-lg p-1">
                  <img 
                    src="data:image/jpeg;base64,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"
                    alt="Welisa Logo"
                    className="h-10 w-10 object-contain"
                  />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Smart Customer Matching
                </h1>
                <p className="text-sm text-gray-600">
                  {useAI ? 'AI-Powered Intelligence' : 'Advanced Pattern Matching'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              {customerData.length > 0 && (
                <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-full">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">{customerData.length} customers</span>
                  </div>
                  {matchHistory.length > 0 && (
                    <>
                      <div className="w-px h-4 bg-gray-300"></div>
                      <div className="flex items-center gap-2">
                        <Brain className="h-3 w-3 text-purple-600" />
                        <span className="text-sm font-medium">{matchHistory.length} learned</span>
                      </div>
                    </>
                  )}
                  {searchStatus.isImproving && (
                    <>
                      <div className="w-px h-4 bg-gray-300"></div>
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-3 w-3 text-purple-600 animate-spin" />
                        <span className="text-sm font-medium text-purple-600">Optimizing</span>
                      </div>
                    </>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600">AI Mode</span>
                <button
                  onClick={() => setUseAI(!useAI)}
                  className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                    useAI 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600' 
                      : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-lg transform transition-all duration-300 ${
                    useAI ? 'translate-x-7' : 'translate-x-0'
                  }`}>
                    {useAI && (
                      <Sparkles className="h-3 w-3 text-purple-600 absolute top-1.5 left-1.5" />
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {matchingProgress > 0 && (
          <div className={`transition-all duration-300 ${aiValidationStatus ? 'mb-10' : 'mb-6'}`}>
            <div className="relative">
              <div className="overflow-hidden h-2 text-xs flex rounded-full bg-gray-200">
                <div 
                  style={{ width: `${matchingProgress}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300 ease-out"
                />
              </div>
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                <span className="text-xs font-medium text-gray-600">
                  {matchingProgress < 50 ? 'Analyzing...' : matchingProgress < 75 ? 'Matching...' : 'Finalizing...'}
                  {searchIteration > 1 && ` (Iteration ${searchIteration}/3)`}
                </span>
              </div>
              {aiValidationStatus && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                  <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                    {aiValidationStatus}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {searchStatus.stage && (
              <div className={`bg-white rounded-xl shadow-lg border overflow-hidden transition-all duration-300 ${
                searchStatus.isImproving ? 'border-purple-300 animate-pulse-subtle' : 'border-gray-200'
              }`}>
                <div className="p-4">
                  <div className="mb-3">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span className="font-medium">{searchStatus.message}</span>
                      <span>{Math.round(matchingProgress)}%</span>
                    </div>
                    <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${matchingProgress}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
                      </div>
                    </div>
                  </div>
                  
                  {useAI && searchStatus.totalStages > 1 && (
                    <div className="flex items-center justify-between">
                      {['Basic Search', 'AI Analysis', 'AI Validation', 'Optimization'].slice(0, searchStatus.totalStages).map((stage, index) => {
                        const isComplete = index < searchStatus.currentStage - 1;
                        const isCurrent = index === searchStatus.currentStage - 1;
                        const isPending = index > searchStatus.currentStage - 1;
                        
                        return (
                          <div key={stage} className="flex items-center">
                            <div className={`flex items-center ${index < searchStatus.totalStages - 1 ? 'flex-1' : ''}`}>
                              <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${
                                isComplete ? 'bg-green-500' :
                                isCurrent ? 'bg-purple-600 animate-pulse' :
                                'bg-gray-300'
                              }`}>
                                {isComplete && <CheckCircle className="h-5 w-5 text-white" />}
                                {isCurrent && <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>}
                                {isPending && <div className="w-3 h-3 bg-gray-400 rounded-full"></div>}
                              </div>
                              <div className="ml-2">
                                <div className={`text-xs font-medium ${
                                  isComplete ? 'text-green-600' :
                                  isCurrent ? 'text-purple-600' :
                                  'text-gray-400'
                                }`}>
                                  {stage}
                                </div>
                                {isCurrent && searchIteration > 1 && (
                                  <div className="text-xs text-purple-500">
                                    Iteration {searchIteration}
                                  </div>
                                )}
                              </div>
                            </div>
                            {index < searchStatus.totalStages - 1 && (
                              <div className={`mx-3 h-0.5 w-12 transition-all duration-500 ${
                                isComplete ? 'bg-green-500' : 'bg-gray-300'
                              }`}></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {searchStatus.isImproving && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-purple-600">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>AI is actively improving your results...</span>
                    </div>
                  )}
                  
                  {searchStatus.stage === 'fallback' && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-orange-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>AI temporarily unavailable - using traditional matching</span>
                    </div>
                  )}
                  
                  {searchStatus.stage === 'error' && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Some AI features encountered errors - results may be limited</span>
                    </div>
                  )}
                  
                  {searchStatus.stage === 'complete' && searchIteration > 1 && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>{searchStatus.message}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg">
                      <Target className="h-5 w-5 text-purple-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">Company Description</h2>
                  </div>
                  {liveTyping && (
                    <div className="flex items-center gap-2 text-sm text-purple-600">
                      <div className="flex gap-1">
                        <div className="w-1 h-1 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1 h-1 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1 h-1 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span>Analyzing</span>
                    </div>
                  )}
                </div>
                
                <div className="relative">
                  <textarea
                    value={inputDescription}
                    onChange={(e) => setInputDescription(e.target.value)}
                    placeholder="Paste or type your company description here for intelligent matching..."
                    className="w-full h-64 p-4 border-2 border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  />
                  <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                    {inputDescription.length} characters
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-4">
                  <div className="flex items-center gap-3">
                    {customerData.length === 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg text-sm">
                        <AlertCircle className="h-4 w-4" />
                        Upload CSV first
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={findMatches}
                    disabled={!inputDescription.trim() || isLoading || customerData.length === 0}
                    className={`px-6 py-3 rounded-xl text-white font-medium flex items-center gap-2 transition-all duration-200 ${
                      isLoading || !inputDescription.trim() || customerData.length === 0
                        ? 'bg-gray-300 cursor-not-allowed'
                        : useAI 
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transform hover:scale-105 shadow-lg hover:shadow-xl'
                          : 'bg-blue-600 hover:bg-blue-700 transform hover:scale-105 shadow-lg hover:shadow-xl'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        Find Matches
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {isAnalyzing && (
                <div className="border-t border-gray-100 p-4 bg-gradient-to-r from-purple-50 to-blue-50">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Brain className="h-5 w-5 text-purple-600 animate-pulse" />
                      <div className="absolute inset-0 bg-purple-600 rounded-full blur-md opacity-50 animate-pulse"></div>
                    </div>
                    <span className="text-sm font-medium text-purple-800">AI is analyzing your description...</span>
                  </div>
                </div>
              )}
              
              {searchStatus.stage === 'fallback' && !isAnalyzing && (
                <div className="border-t border-gray-100 p-4 bg-orange-50">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <div>
                      <span className="text-sm font-medium text-orange-800">AI Analysis Unavailable</span>
                      <p className="text-xs text-orange-700 mt-0.5">Continuing with traditional matching</p>
                    </div>
                  </div>
                </div>
              )}
              
              {aiAnalysis && !isAnalyzing && (
                <div className="border-t border-gray-100 p-4 bg-gradient-to-r from-purple-50 to-blue-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-purple-600" />
                      <span className="text-sm font-semibold text-purple-800">AI Analysis Complete</span>
                    </div>
                    {aiConfidence && (
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-purple-600">Confidence</div>
                        <div className="w-24 bg-purple-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${aiConfidence * 100}%` }}
                          />
                        </div>
                        <div className="text-xs font-medium text-purple-700">{Math.round(aiConfidence * 100)}%</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-purple-600 font-medium">Sector:</span>
                      <span className="ml-2 text-gray-700">{aiAnalysis.sector}</span>
                    </div>
                    <div>
                      <span className="text-purple-600 font-medium">Complexity:</span>
                      <span className="ml-2 text-gray-700 capitalize">{aiAnalysis.businessComplexity}</span>
                    </div>
                  </div>
                  
                  {aiAnalysis.keyStrengths && aiAnalysis.keyStrengths.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {aiAnalysis.keyStrengths.map((strength, i) => (
                        <span key={i} className="px-3 py-1 bg-white/80 backdrop-blur text-xs font-medium text-purple-700 rounded-full shadow-sm">
                          {strength}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {isLoading ? null : inputDescription.trim() && matches.length === 0 && searchStatus.stage === '' ? (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 text-center">
                <TrendingDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Suitable Matches Found</h3>
                <p className="text-gray-600 mb-4">
                  We couldn't find any customers that match your criteria with sufficient similarity.
                </p>
                <div className="text-sm text-gray-500 space-y-2">
                  <p>Try the following:</p>
                  <ul className="text-left max-w-md mx-auto space-y-1">
                    <li>• Use more general industry terms</li>
                    <li>• Focus on core business activities rather than specific services</li>
                    <li>• Check if your customer database contains companies in this sector</li>
                    <li>• Enable AI mode for more intelligent matching</li>
                  </ul>
                </div>
              </div>
            ) : null}
            
            {matches.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                      Top Matches
                      {searchStatus.isImproving && (
                        <span className="text-sm font-normal text-purple-600 bg-purple-50 px-3 py-1 rounded-full animate-pulse">
                          <RefreshCw className="h-3 w-3 inline mr-1 animate-spin" />
                          Improving...
                        </span>
                      )}
                      {searchStatus.stage === 'complete' && searchIteration > 1 && (
                        <span className="text-sm font-normal text-green-600 bg-green-50 px-3 py-1 rounded-full">
                          ✨ Optimized via {searchIteration} iterations
                        </span>
                      )}
                    </h2>
                    {searchStatus.isImproving && (
                      <p className="text-sm text-gray-600 mt-1">
                        Results shown below are being enhanced with AI validation
                      </p>
                    )}
                  </div>
                  <button
                    onClick={exportMatches}
                    disabled={searchStatus.isImproving}
                    className={`flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg transition-colors ${
                      searchStatus.isImproving 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                </div>
                
                {matches.length > 0 && matches[0].totalScore < 0.5 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-yellow-900">Low Match Quality</h3>
                        <p className="text-sm text-yellow-800 mt-1">
                          The best matches found have low similarity scores. This might indicate:
                        </p>
                        <ul className="text-sm text-yellow-700 mt-2 space-y-1 ml-4">
                          <li>• Your customer database may not contain companies in this sector</li>
                          <li>• Try broader search terms or different industry keywords</li>
                          <li>• Consider uploading a more diverse customer database</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                {matches.map((match, index) => (
                  <div
                    key={`${match.Bedrijf}-${index}-${match.totalScore}`}
                    className={`match-card bg-white rounded-xl shadow-lg border overflow-hidden transition-all duration-500 ${
                      index === 0 ? 'border-purple-200 shadow-purple-100' : 'border-gray-100'
                    } ${searchStatus.isImproving ? 'opacity-90' : ''} hover:shadow-xl hover:scale-[1.02] cursor-pointer ${
                      match.aiScore !== undefined && searchStatus.stage === 'ai-validation' ? 'animate-fade-in' : ''
                    }`}
                    onClick={() => setExpandedMatch(expandedMatch === index ? null : index)}
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <div className={`text-3xl font-bold ${
                              index === 0 ? 'text-purple-600' : 'text-gray-400'
                            }`}>
                              #{index + 1}
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold text-gray-900">{match.Bedrijf}</h3>
                              <p className="text-gray-600 mt-1">{match.Kernactiviteit}</p>
                            </div>
                          </div>
                          
                          {match.aiInsight && (
                            <div className="flex items-center gap-2 mt-3">
                              {match.aiInsight.strategicFit === 'high' && (
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                                  <Star className="h-3 w-3" />
                                  High Strategic Fit
                                </span>
                              )}
                              {match.aiInsight.conversionProbability === 'high' && (
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium flex items-center gap-1">
                                  <Flame className="h-3 w-3" />
                                  Hot Lead
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <div className={`text-4xl font-bold ${
                            match.totalScore > 0.8 ? 'text-purple-600' :
                            match.totalScore > 0.6 ? 'text-blue-600' :
                            match.totalScore > 0.4 ? 'text-green-600' :
                            'text-gray-600'
                          }`}>
                            {Math.round(match.totalScore * 100)}%
                            {searchStatus.isImproving && match.aiScore === undefined && (
                              <div className="text-xs text-gray-500 mt-1 normal-case">
                                <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
                                Validating...
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {useAI && match.aiScore !== undefined ? 'AI-Blended Score' : 'Match Score'}
                          </div>
                          {useAI && match.aiScore !== undefined && (
                            <div className="text-xs text-purple-600 mt-1">
                              AI: {Math.round(match.aiScore * 100)}%
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <div className="text-xs text-gray-500">Sector</div>
                          <div className="text-sm font-medium text-gray-900">{match.Sector}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Sales Model</div>
                          <div className="text-sm font-medium text-gray-900">{match.Verkoopmodel}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Deal Size</div>
                          <div className="text-sm font-medium text-gray-900">{match.Dealsize}</div>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-purple-600 mt-0.5" />
                          <div className="text-sm text-gray-700">{match.explanation}</div>
                        </div>
                      </div>
                      
                      {expandedMatch === index && (
                        <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in">
                          <div className="mb-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg">
                            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                              <BarChart3 className="h-5 w-5 text-blue-600" />
                              Detailed Match Analysis
                              {useAI && match.aiScore !== undefined && (
                                <span className="text-xs font-normal text-purple-600 bg-purple-50 px-2 py-1 rounded-full ml-auto">
                                  AI validated
                                </span>
                              )}
                            </h4>
                            
                            {match.inputInfo && (match.inputInfo.sector || match.inputInfo.kernactiviteit) && (
                              <div className="mb-3 p-3 bg-white/70 rounded-lg text-sm">
                                <div className="font-medium text-gray-700 mb-1">You searched for:</div>
                                <div className="text-gray-600">
                                  {match.inputInfo.sector && <span>• Sector: {match.inputInfo.sector}<br/></span>}
                                  {match.inputInfo.kernactiviteit && <span>• Core Activity: {match.inputInfo.kernactiviteit}<br/></span>}
                                  {match.inputInfo.salesModel && <span>• Sales Model: {match.inputInfo.salesModel}</span>}
                                </div>
                              </div>
                            )}
                            
                            <div className="space-y-2">
                              {match.scores.sector > 0.3 && (
                                <div className="flex items-start gap-2">
                                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></div>
                                  <div className="text-sm flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">Sector Match:</span>
                                      <span className={`font-bold ${match.scores.sector > 0.7 ? 'text-green-600' : match.scores.sector > 0.5 ? 'text-blue-600' : 'text-gray-600'}`}>
                                        {Math.round(match.scores.sector * 100)}%
                                      </span>
                                    </div>
                                    <span className="text-gray-700">
                                      Both operate in "{match.Sector}" industry
                                    </span>
                                  </div>
                                </div>
                              )}
                              
                              {match.scores.kernactiviteit > 0.3 && (
                                <div className="flex items-start gap-2">
                                  <div className="w-2 h-2 bg-purple-600 rounded-full mt-1.5 flex-shrink-0"></div>
                                  <div className="text-sm flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">Core Activity Match:</span>
                                      <span className={`font-bold ${match.scores.kernactiviteit > 0.7 ? 'text-green-600' : match.scores.kernactiviteit > 0.5 ? 'text-blue-600' : 'text-gray-600'}`}>
                                        {Math.round(match.scores.kernactiviteit * 100)}%
                                      </span>
                                    </div>
                                    <span className="text-gray-700">
                                      Similar business focus in {match.Kernactiviteit}
                                    </span>
                                  </div>
                                </div>
                              )}
                              
                              {match.scores.salesModel > 0.3 && (
                                <div className="flex items-start gap-2">
                                  <div className="w-2 h-2 bg-green-600 rounded-full mt-1.5 flex-shrink-0"></div>
                                  <div className="text-sm flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">Sales Model Match:</span>
                                      <span className={`font-bold ${match.scores.salesModel > 0.7 ? 'text-green-600' : match.scores.salesModel > 0.5 ? 'text-blue-600' : 'text-gray-600'}`}>
                                        {Math.round(match.scores.salesModel * 100)}%
                                      </span>
                                    </div>
                                    <span className="text-gray-700">
                                      Both use {match.Verkoopmodel} approach
                                    </span>
                                  </div>
                                </div>
                              )}
                              
                              {match.scores.serviceModel > 0.3 && (
                                <div className="flex items-start gap-2">
                                  <div className="w-2 h-2 bg-indigo-600 rounded-full mt-1.5 flex-shrink-0"></div>
                                  <div className="text-sm flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">Service Model Match:</span>
                                      <span className={`font-bold ${match.scores.serviceModel > 0.7 ? 'text-green-600' : match.scores.serviceModel > 0.5 ? 'text-blue-600' : 'text-gray-600'}`}>
                                        {Math.round(match.scores.serviceModel * 100)}%
                                      </span>
                                    </div>
                                    <span className="text-gray-700">
                                      Compatible service delivery: {match.Servicemodel}
                                    </span>
                                  </div>
                                </div>
                              )}
                              
                              {match.scores.products > 0.3 && (
                                <div className="flex items-start gap-2">
                                  <div className="w-2 h-2 bg-orange-600 rounded-full mt-1.5 flex-shrink-0"></div>
                                  <div className="text-sm flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">Product/Service Match:</span>
                                      <span className={`font-bold ${match.scores.products > 0.7 ? 'text-green-600' : match.scores.products > 0.5 ? 'text-blue-600' : 'text-gray-600'}`}>
                                        {Math.round(match.scores.products * 100)}%
                                      </span>
                                    </div>
                                    <span className="text-gray-700">
                                      Similar offerings in their portfolio
                                    </span>
                                  </div>
                                </div>
                              )}
                              
                              {match.scores.customerProfile > 0.3 && (
                                <div className="flex items-start gap-2">
                                  <div className="w-2 h-2 bg-pink-600 rounded-full mt-1.5 flex-shrink-0"></div>
                                  <div className="text-sm flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">Customer Match:</span>
                                      <span className={`font-bold ${match.scores.customerProfile > 0.7 ? 'text-green-600' : match.scores.customerProfile > 0.5 ? 'text-blue-600' : 'text-gray-600'}`}>
                                        {Math.round(match.scores.customerProfile * 100)}%
                                      </span>
                                    </div>
                                    <span className="text-gray-700">
                                      Target similar customers: {match.Klantprofiel}
                                    </span>
                                  </div>
                                </div>
                              )}
                              
                              {match.scores.dealSize > 0.3 && (
                                <div className="flex items-start gap-2">
                                  <div className="w-2 h-2 bg-yellow-600 rounded-full mt-1.5 flex-shrink-0"></div>
                                  <div className="text-sm flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">Deal Size Match:</span>
                                      <span className={`font-bold ${match.scores.dealSize > 0.7 ? 'text-green-600' : match.scores.dealSize > 0.5 ? 'text-blue-600' : 'text-gray-600'}`}>
                                        {Math.round(match.scores.dealSize * 100)}%
                                      </span>
                                    </div>
                                    <span className="text-gray-700">
                                      Similar deal ranges: {match.Dealsize}
                                    </span>
                                  </div>
                                </div>
                              )}
                              
                              {match.bonusScore > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <h5 className="font-medium text-gray-900 mb-2">Special Match Factors:</h5>
                                  
                                  {match.inputInfo.dealerDriven && match.Verkoopmodel && match.Verkoopmodel.toLowerCase().includes('dealer') && (
                                    <div className="flex items-start gap-2">
                                      <div className="w-2 h-2 bg-red-600 rounded-full mt-1.5 flex-shrink-0"></div>
                                      <div className="text-sm">
                                        <span className="font-medium text-red-700">Dealer Network Bonus:</span>
                                        <span className="text-gray-700 ml-2">
                                          Both companies use dealer/partner networks
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {match.inputInfo.tenderInvolved && match.Kernproces && match.Kernproces.toLowerCase().includes('tender') && (
                                    <div className="flex items-start gap-2 mt-1">
                                      <div className="w-2 h-2 bg-red-600 rounded-full mt-1.5 flex-shrink-0"></div>
                                      <div className="text-sm">
                                        <span className="font-medium text-red-700">Tender Process Bonus:</span>
                                        <span className="text-gray-700 ml-2">
                                          Both experienced in tender/bidding processes
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {match.inputInfo.engineerToOrder && match.Kernproces && match.Kernproces.toLowerCase().includes('engineer') && (
                                    <div className="flex items-start gap-2 mt-1">
                                      <div className="w-2 h-2 bg-red-600 rounded-full mt-1.5 flex-shrink-0"></div>
                                      <div className="text-sm">
                                        <span className="font-medium text-red-700">Engineer-to-Order Bonus:</span>
                                        <span className="text-gray-700 ml-2">
                                          Both handle custom engineering projects
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Products/Services:</span>
                              <p className="text-gray-900 mt-1">{match['Producten/Diensten']}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Core Process:</span>
                              <p className="text-gray-900 mt-1">{match.Kernproces || 'Not specified'}</p>
                            </div>
                          </div>
                          
                          {match.aiInsight && match.aiInsight.salesInsight && (
                            <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                              <div className="flex items-start gap-2">
                                <Rocket className="h-4 w-4 text-purple-600 mt-0.5" />
                                <div>
                                  <div className="text-sm font-medium text-purple-800">AI Sales Insight</div>
                                  <div className="text-sm text-purple-700 mt-1">{match.aiInsight.salesInsight}</div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {showAdvancedMetrics && (
                            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                              <h5 className="text-xs font-medium text-gray-700 mb-2">Detailed Scoring Breakdown</h5>
                              
                              {useAI && match.aiScore !== undefined && (
                                <div className="mb-3 p-2 bg-white rounded border border-gray-200">
                                  <div className="text-xs font-medium text-gray-600 mb-1">Score Composition:</div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <div className="flex items-center gap-1">
                                      <div className="w-3 h-3 bg-blue-500 rounded"></div>
                                      <span>Traditional: 50%</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <div className="w-3 h-3 bg-purple-500 rounded"></div>
                                      <span>AI: 50%</span>
                                    </div>
                                    <div className="ml-auto font-medium">
                                      Final: {Math.round(match.totalScore * 100)}%
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-4 gap-2 text-xs">
                                {Object.entries(match.scores).map(([key, value]) => (
                                  <div key={key} className="text-center">
                                    <div className="text-gray-500 capitalize">{key}</div>
                                    <div className="font-medium text-gray-900">{Math.round(value * 100)}%</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="px-6 pb-3 flex items-center justify-center text-xs text-gray-400">
                      <ChevronRight className={`h-3 w-3 transition-transform mr-1 ${expandedMatch === index ? 'rotate-90' : ''}`} />
                      Click to see detailed match analysis
                    </div>
                  </div>
                ))}
                
                <div className="flex justify-center mt-4">
                  <button
                    onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {showAdvancedMetrics ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showAdvancedMetrics ? 'Hide' : 'Show'} Advanced Metrics
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Customer Database</h2>
                  {uploadedFile && (
                    <button
                      onClick={clearUploadedData}
                      className="text-red-600 hover:text-red-700 p-1"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
                
                {customerData.length === 0 ? (
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                      dragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {dragActive ? 'Drop your CSV here' : 'Upload Customer CSV'}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Drag & drop or click to browse
                    </p>
                    <input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="csv-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      Choose File
                    </label>
                    <div className="mt-4 text-xs text-gray-500">
                      <div className="font-medium mb-1">CSV Requirements:</div>
                      <div className="space-y-0.5">
                        <div>• Required columns: Bedrijf, Kernactiviteit, Sector</div>
                        <div>• Supported delimiters: comma (,), semicolon (;), tab, pipe (|)</div>
                        <div>• Auto-detects delimiter and encoding</div>
                      </div>
                      
                      <details className="mt-3">
                        <summary className="cursor-pointer text-purple-600 hover:text-purple-700 font-medium">
                          View example format
                        </summary>
                        <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono overflow-x-auto">
                          <div>Bedrijf,Kernactiviteit,Sector,Producten/Diensten</div>
                          <div>Company A,Manufacturing,Automotive,Electric vehicles</div>
                          <div>Company B,Software development,Technology,SaaS platform</div>
                        </div>
                      </details>
                    </div>
                  </div>
                ) : (
                  <div>
                    {uploadStatus === 'success' && (
                      <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200 animate-fade-in">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <div>
                            <div className="font-medium text-green-900">Success!</div>
                            <div className="text-sm text-green-700">
                              {customerData.length} customers loaded
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search customers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {(searchTerm ? filteredCustomers : customerData.slice(0, 10)).map((customer, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="font-medium text-sm text-gray-900">{customer.Bedrijf}</div>
                          <div className="text-xs text-gray-600 mt-1">{customer.Sector}</div>
                          <div className="text-xs text-gray-500">{customer.Kernactiviteit}</div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 text-center">
                      <div className="text-sm text-gray-500">
                        Showing {searchTerm ? filteredCustomers.length : Math.min(10, customerData.length)} of {customerData.length}
                      </div>
                      
                      <input
                        id="csv-replace"
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="csv-replace"
                        className="inline-flex items-center gap-2 mt-3 px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Replace Database
                      </label>
                    </div>
                  </div>
                )}
                
                {uploadStatus === 'error' && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-red-900 mb-1">Upload Error</div>
                        <div className="text-sm text-red-700">{uploadError}</div>
                        <div className="mt-2 text-xs text-red-600">
                          <div className="font-medium mb-1">Tips:</div>
                          <ul className="space-y-0.5 ml-3">
                            <li>• Ensure your CSV has columns: Bedrijf, Kernactiviteit, Sector</li>
                            <li>• The file can use comma, semicolon, tab, or pipe delimiters</li>
                            <li>• Column names are case-sensitive</li>
                            <li>• Remove any empty columns or rows</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl shadow-xl p-6 text-white">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Pro Tips
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Include specific technologies and certifications for better matches</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Mention deal sizes and business models for accurate scoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>AI mode learns from your matches to improve over time</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
