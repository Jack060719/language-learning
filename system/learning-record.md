# 學習紀錄格式與 Codex 回寫契約

網站只保存學習事件，不保存登入密碼或 Supabase secret key。每次課程、到期複習或關卡是一筆不可重複的事件；網站由事件重新計算儀表板、複習日期與階段。事件時間使用 ISO 8601，學習日與到期日按 Asia/Taipei 計算。

## `LearningEvent v1`

Codex 回傳以下 JSON，網站貼入後檢查欄位，將登入者 `user_id` 自行加入後存入 Supabase。相同 `event_id` 再貼一次不得重複計數。

```json
{
  "schema_version": 1,
  "event_id": "4a03b931-41b2-4716-aeca-ecab0c79c132",
  "event_type": "lesson",
  "occurred_at": "2026-10-04T10:00:00+08:00",
  "payload": {
    "language": "es",
    "lesson_id": "es-A1-01-L01",
    "mode": "daily",
    "duration_minutes": 40,
    "listening_minutes": 8,
    "speaking_sessions": 1,
    "writing_sessions": 1,
    "output_passed": true,
    "items": [
      {
        "id": "es-A1-01-v01",
        "kind": "vocabulary",
        "front": "如何用西文說「我叫……」？",
        "back": "Me llamo…",
        "result": "correct",
        "error_key": "self-introduction",
        "error_category": "Verb Conjugation"
      }
    ],
    "corrections": [
      {
        "original": "Yo es Ana.",
        "corrected": "Soy Ana.",
        "reason": "第一人稱使用 soy。",
        "natural": "Me llamo Ana.",
        "category": "Verb Conjugation",
        "error_key": "self-introduction"
      }
    ]
  }
}
```

`event_type` 可為 `lesson`、`review`、`assessment`。`language` 為 `es` 或 `it`。`mode` 為 `daily`、`intensive`、`maintenance` 或 `review`；`output_passed` 記錄當課輸出是否達標。`items` 的 `kind` 為 `vocabulary`、`grammar`、`pattern`；`result` 為 `introduced`、`correct`、`incorrect`。答錯項可另外提供 `error_category` 與 `mistake`。`corrections` 可以為空陣列，但任何已作答的自由輸出須逐句批改；自然說法放在 `natural`。同一種錯誤與補強題共用穩定 `error_key`，供網站判斷反覆出錯及改善。新的複習項必須有穩定 ID、提示 `front` 和答案 `back`，後續複習保持同一 ID。

`review` 事件只需要 `language` 與 `items`；每個項目均須是 `correct` 或 `incorrect`。`assessment` 事件的 `payload` 使用 [評量格式](assessment.md)。網站拒絕缺欄、未知語言／類別／結果、無效日期與未解鎖的義文事件；錯誤訊息指出要修正哪一項。

## 交接流程

1. 網站「學習紀錄」頁讓學習者輸入課次與原始作答，複製含唯一 `event_id` 及目前 `teacher_context`（階段、到期卡、弱點）的請求包給 Codex。開始新課時也可從儀表板單獨複製學習摘要。若有錄音，另於可收音訊的介面附檔。
2. Codex 根據教材、作答及口語／音訊證據逐句批改，回傳一筆符合上方格式的 JSON。沒有真實音訊證據，不得聲稱已測聽力或發音。
3. 網站顯示批改摘要，儲存成功後才更新統計。網路失敗時保留貼入內容供重試。

## 儀表板欄位

Language、CEFR Level、Lessons Completed、Vocabulary Learned、Grammar Topics、Listening Hours、Speaking Sessions、Writing Sessions、Review Accuracy、Common Errors、Current Weaknesses、Next Goal。課數計不同 `lesson_id`，詞彙／文法計不同項目 ID，時數與輸出次數由事件加總；Review Accuracy 用最近 30 天到期項目的正確次數／作答次數。能力級別只讀取通過的正式關卡事件，不由課數推測。
