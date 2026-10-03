# 語言學習系統

這是一套給繁體中文母語者使用的長期西班牙文與義大利文學習專案。先將西班牙文由零基礎練到 CEFR B1，通過關卡後維持西文並開始義大利文。課程以理解、回想、輸出及間隔複習為核心；完課數不代表語言能力。

## 從哪裡開始

1. 閱讀 [ROADMAP.md](ROADMAP.md) 與 [西文課程地圖](maps/spanish.md)。義文地圖已規劃，但在西文 B1 通過前不得開始義文課程。
2. 開啟網站，使用電子郵件登入。課程地圖公開，個人進度儲存在受登入保護的 Supabase 資料表。
3. 對 Codex 說「開始 Spanish A1 Lesson 1」才開始第一課。請它遵循本專案的課堂格式與目前網站的弱點提示。
4. 每課完成後，網站「學習紀錄」頁可複製作答紀錄包給 Codex；將 Codex 回傳的 JSON 批改包貼回網站，網站便更新進度、錯誤紀錄與複習卡。使用語音時另附錄音或直接使用語音介面。
5. 按「到期複習」完成回想。必須通過 [CEFR 關卡](system/assessment.md) 才能解鎖下一級。

目前只建立制度、課程地圖與追蹤工具，**沒有 Lesson 1 教材，也不會自動開始教學**。

## 專案內容

- [ROADMAP.md](ROADMAP.md)：階段順序、每日與每週節奏、調整規則。
- [西文地圖](maps/spanish.md)、[義文地圖](maps/italian.md)：逐單元規劃及每級可觀察的能力。
- [學習紀錄格式](system/learning-record.md)、[Error Log](system/error-log.md)：Codex 與網站共用的紀錄契約。
- [複習規則](system/review.md)、[評量規則](system/assessment.md)：何時複習、何時升級。

## 網站運行與發布

需要 Node.js。執行 `npm.cmd install`、`npm.cmd run dev` 以在本機預覽；`npm.cmd test` 驗證排程和關卡；`npm.cmd run build` 產生 `dist/`。GitHub Actions 將 `main` 分支建置結果發布到 GitHub Pages。

建立專用 Supabase 專案後，於 SQL Editor 執行 [`supabase/schema.sql`](supabase/schema.sql)，啟用 Email OTP 登入，並在 Auth URL 設定加入本機網址及 GitHub Pages 網址。GitHub 倉庫設定 Actions variables `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`、`VITE_BASE_PATH`（此專案為 `/language-learning/`）；本機設定可參考 `.env.example`。前端只使用可公開的 publishable key，不得放入 secret 或 service-role key。網站公開，但學習者資料不寫入公開 Git 倉庫。

若未設定 Supabase，網站仍可閱讀課程文件；登入和追蹤功能會明確提示尚未連線。若匯入失敗，請保留批改包重試，網站不會假稱資料已儲存。

## 教師使用原則

每次授課前檢查目前階段、到期複習及弱點。每課先提供完整教材，再請學習者練習；口說對話模式可逐輪互動。中文解釋逐級減少，A1 約中 80%／目標語 20%，A2 約 60%／40%，B1 約 30%／70%；以可理解為先。新課含 8–15 個放在自然句中的核心詞、少量文法、3–8 個實用句型、一段先不附中文翻譯的輸入、理解問題、口說、3–8 句起的寫作，以及不先給答案的回想。批改逐句寫出「原句／修正／原因」，文法正確但不自然也要指出。義文課另檢查 Spanish Interference。

內部關卡依 CEFR 能力描述設計，不是官方語言證書。
