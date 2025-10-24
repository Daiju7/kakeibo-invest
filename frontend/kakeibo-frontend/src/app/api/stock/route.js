/**
 * 📈 Stock API Route - S&P500株価データ取得API (キャッシュ対応版)
 * 
 * 【ファイルの役割】
 * - バックエンドのキャッシュ機能を経由してS&P500 (SPY ETF) の月次株価データを取得
 * - Alpha Vantage APIの制限回避のためMySQLキャッシュを使用
 * - フロントエンドからのリクエストに対して株価データをJSONで返却
 * 
 * 【処理の流れ】
 * 1. バックエンドのキャッシュAPIエンドポイントを呼び出し
 * 2. キャッシュヒット時は高速レスポンス、ミス時は新データ取得
 * 3. Alpha Vantage形式のデータをフロントエンドに返却
 * 
 * 【使用される場面】
 * - 投資シミュレーションページでの株価チャート表示
 * - 仮想投資シミュレーターでの計算基準データ
 * - 家計簿連携投資シミュレーションでの成果計算
 */

// Next.js App Router API Route
// GETリクエストを処理する関数をエクスポート
export async function GET(request) {
    const symbol = "SPY"; // S&P500を追跡するETF
    
    try {
        // 【STEP 1】バックエンドのキャッシュAPIを呼び出し
        console.log("Fetching stock data with cache for:", symbol);
        const backendUrl = `http://localhost:3000/api/stock-cached/${symbol}`;
        const response = await fetch(backendUrl);
        const result = await response.json();

        // 【STEP 2】バックエンドからのレスポンスチェック
        if (!response.ok) {
            console.error("Backend cache API error:", result.error);
            return new Response(JSON.stringify({ 
                error: result.error,
                message: result.message
            }), { 
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 【STEP 3】キャッシュ状況をログ出力
        if (result.cached) {
            console.log(`📦 Using cached data for ${symbol}`);
        } else {
            console.log(`🧪 Using fresh data for ${symbol} (test mode: ${result.testMode || false})`);
        }

        // result.dataにAlpha Vantage形式のデータが含まれている
        return Response.json(result.data);
        
    } catch (error) {
        // 【STEP 5】予期しないエラーのハンドリング
        console.error("Error fetching stock data via cache:", error);
        return new Response(JSON.stringify({ 
            error: "Failed to fetch stock data",
            message: error.message
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}