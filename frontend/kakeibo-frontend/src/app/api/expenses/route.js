/**
 * 💰 Expenses API Route - 家計簿データ取得・処理API
 * 
 * 【ファイルの役割】
 * - バックエンドサーバーから家計簿データ(全カテゴリ)を取得
 * - 投資カテゴリーのデータのみを抽出・加工
 * - 月別投資額の集計とソート処理
 * - 投資シミュレーション用のデータ構造に変換
 * 
 * 【処理の流れ】
 * 1. バックエンドの `/expenses` エンドポイントにリクエスト
 * 2. 全ての家計簿データを取得
 * 3. `category === 'investment'` のデータのみフィルタリング
 * 4. 日付ベースで月別にグループ化
 * 5. 各月の投資額を合計
 * 6. 日付順にソートして返却
 * 
 * 【返却データ構造】
 * {
 *   success: true,
 *   totalInvestments: 投資回数,
 *   monthlyData: [{ month: "2023-01", totalAmount: 50000, transactions: [...] }],
 *   totalAmount: 総投資額
 * }
 * 
 * 【使用される場面】
 * - 家計簿連携投資シミュレーションでの元データ
 * - 実際の投資履歴ベースでのパフォーマンス計算
 */

// バックエンドから投資支出を取得するNext.js APIルート
// GETリクエストを処理する関数をエクスポート
export async function GET(request) {
    try {
        // 【STEP 1】バックエンドサーバーの設定
        // Express.jsサーバー (port 3000) の家計簿データエンドポイント
        const backendUrl = "https://kakeibo-backend-7c1q.onrender.com/expenses";
        
        console.log("Fetching expenses from backend:", backendUrl);
        const cookie = request.headers.get("cookie");
        
        // 【STEP 2】バックエンドから全ての家計簿データを取得
        // server.jsの GET /expenses エンドポイントを呼び出し
        const response = await fetch(backendUrl, {
            headers: cookie ? { Cookie: cookie } : {}
        });
        
        // 【STEP 3】レスポンスステータスの確認
        //!response.okとは、HTTPレスポンスが正常かどうかを示すプロパティ。
        if (!response.ok) {
            let payload;
            try {
                payload = await response.json();
            } catch (parseError) {
                payload = { error: "Backend server error" };
            }
            return new Response(JSON.stringify(payload), {
                status: response.status,
                headers: { "Content-Type": "application/json" }
            });
        }
        
        // 【STEP 4】JSONデータの解析
        // MySQL kakeibo_dataテーブルの全レコードを取得
        // データ構造: [{ id, title, category, amount, date }, ...]
        const allExpenses = await response.json();
        
        // 【STEP 5】投資カテゴリーのデータのみを抽出
        // カテゴリーが 'investment' のレコードのみフィルタリング
        const investmentExpenses = allExpenses.filter(expense => expense.category === 'investment');
        
        // 【STEP 6】月別データのグループ化処理
        const monthlyInvestments = investmentExpenses.reduce((acc, expense) => {
            // 6-1. 日付文字列をDateオブジェクトに変換
            const date = new Date(expense.date);
            
            // 6-2. YYYY-MM形式の月キーを生成
            //何をしているかというと、例えば2023年1月なら"2023-01"、12月なら"2023-12"のようにフォーマットしている。
            // padstartは文字列の長さを指定した長さに揃えるために使われるメソッドで、ここでは月が1桁の場合に先頭に0を追加して2桁に揃えている。
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; 

            // 6-3. 該当月のデータ構造を初期化 (初回のみ)
            //ここでは、月ごとの投資データを格納するためのもの
            //1ヶ月ごとに投資額の合計とその月の取引一覧を保存するためのオブジェクトを作成している。
            if (!acc[monthKey]) {
                acc[monthKey] = {
                    month: monthKey,
                    totalAmount: 0,        // その月の投資額合計
                    transactions: []       // その月の投資取引一覧
                };
            }
            
            // 6-4. 投資額を累積加算 (文字列→数値変換)
            acc[monthKey].totalAmount += parseInt(expense.amount);
            
            // 6-5. 取引詳細を配列に追加
            //投資取引の詳細とは、具体的にはその月に行われた各投資支出の情報を指している。例えば、投資のタイトル、金額、日付などが含まれる。
            acc[monthKey].transactions.push(expense);　//transactions配列に現在のexpenseオブジェクトを追加している。これにより、その月に行われたすべての投資取引の詳細が保存される。
            
            return acc;　
        }, {}); // 初期値: 空のオブジェクト 
        
        // 【STEP 7】月別データの配列化とソート
        // オブジェクト → 配列変換 & 日付昇順ソート
        const sortedMonthlyData = Object.values(monthlyInvestments)
            .sort((a, b) => new Date(a.month) - new Date(b.month));
        //a,bとは、配列内の2つの要素を指しており、ここではそれぞれが月別投資データのオブジェクトを表しています。a,bとは何を表しているかというと、例えば2023年1月のデータと2023年2月のデータなどです。sortメソッドはこれらの要素を比較して、日付順に並べ替えます。引き算

        // 【STEP 8】処理結果のログ出力 (デバッグ用)
        //
        console.log("Investment expenses processed successfully:", sortedMonthlyData.length, "months");
        
        // 【STEP 9】集計結果の返却
        return Response.json({
            success: true,
            totalInvestments: investmentExpenses.length, // 投資回数
            monthlyData: sortedMonthlyData,              // 月別投資データ
            totalAmount: investmentExpenses.reduce(      // 総投資額
                (sum, expense) => sum + parseInt(expense.amount), 0
            )
        });
        
    } catch (error) {
        // 【STEP 10】エラーハンドリング
        // ネットワークエラー、バックエンド接続エラー、データパースエラー等
        console.error("Error fetching investment expenses:", error);
        return new Response(JSON.stringify({ 
            error: "Failed to fetch investment expenses",
            message: error.message
        }), { 
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
