/**
 * 📈 Stock API Route - S&P500株価データ取得API
 * 
 * 【ファイルの役割】
 * - Alpha Vantage APIからS&P500 (SPY ETF) の月次株価データを取得
 * - フロントエンドからのリクエストに対して株価データをJSONで返却
 * - エラーハンドリングと適切なHTTPステータスコードの返却
 * 
 * 【処理の流れ】
 * 1. 環境変数からAlpha Vantage API Keyを取得
 * 2. API KEYの存在確認 (セキュリティチェック)
 * 3. Alpha Vantage APIに月次データをリクエスト
 * 4. レスポンスのエラーチェック (無効なAPIキー、レート制限等)
 * 5. 正常なデータをフロントエンドに返却
 * 
 * 【使用される場面】
 * - 投資シミュレーションページでの株価チャート表示
 * - 仮想投資シミュレーターでの計算基準データ
 * - 家計簿連携投資シミュレーションでの成果計算
 */

// Next.js App Router API Route
// GETリクエストを処理する関数をエクスポート
export async function GET(request) {
    // 【STEP 1】環境変数からAPI KEYを取得
    // .envファイルに設定されたALPHA_VANTAGE_API_KEYを読み込む
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    
    // 【STEP 2】API KEYの存在確認
    // API KEYが設定されていない場合は500エラーを返す
    if (!API_KEY) {
        console.error("ALPHA_VANTAGE_API_KEY is not set in environment variables");
        return new Response(JSON.stringify({ 
            error: "API KEY is not configured",
            message: "Please set ALPHA_VANTAGE_API_KEY in your environment variables"
        }), { 
            status: 500, // Internal Server Error
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    // 【STEP 3】Alpha Vantage API設定
    const symbol = "SPY"; // S&P500を追跡するETF (SPDR S&P 500 ETF Trust)
    // TIME_SERIES_MONTHLY: 月次データを取得 (長期トレンド分析用)
    // 日次データではなく月次データを使用することで、より長期間のデータを効率的に取得
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=${symbol}&apikey=${API_KEY}`;

    try {
        // 【STEP 4】Alpha Vantage APIにリクエスト送信
        console.log("Fetching stock data for:", symbol);
        const response = await fetch(url);
        const data = await response.json();

        // 【STEP 5】APIレスポンスのエラーチェック
        
        // 5-1. 無効なAPIキーや存在しないシンボルの場合
        if (data["Error Message"]) {
            console.error("Alpha Vantage API Error:", data["Error Message"]);
            return new Response(JSON.stringify({ 
                error: "API Error",
                message: data["Error Message"]
            }), { 
                status: 400, // Bad Request
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        }

        // 5-2. API制限に達した場合 (1日5回、1分1回の制限)
        if (data["Note"]) {
            console.error("Alpha Vantage API Rate Limit:", data["Note"]);
            return new Response(JSON.stringify({ 
                error: "Rate Limit Exceeded",
                message: data["Note"]
            }), { 
                status: 429, // Too Many Requests
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        }

        // 【STEP 6】正常なデータの返却
        // Alpha Vantageから取得したJSONデータをそのままフロントエンドに返す
        // データ構造: { "Monthly Time Series": { "2023-01": { "1. open": "400.00", ... }, ... } }
        console.log("Stock data fetched successfully");
        return Response.json(data);
        
    } catch (error) {
        // 【STEP 7】予期しないエラーのハンドリング
        // ネットワークエラー、JSONパースエラー等
        console.error("Error fetching stock data:", error);
        return new Response(JSON.stringify({ 
            error: "Failed to fetch stock data",
            message: error.message
        }), { 
            status: 500, // Internal Server Error
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}