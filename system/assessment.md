# CEFR 關卡與升級規則

關卡依 [歐洲理事會 CEFR 能力描述](https://www.coe.int/en/web/common-european-framework-reference-languages/table-2-cefr-3.3-common-reference-levels-self-assessment-grid)設計，測真實理解與輸出，不以完課數當作通過依據。本專案的分數門檻是內部教學規則，不代表官方 CEFR 證書。

## `assessment` 事件的 `payload`

```json
{
  "language": "es",
  "level": "A1",
  "scores": {
    "listening": 3,
    "reading": 3,
    "spoken_interaction": 3,
    "spoken_production": 4,
    "writing": 4
  },
  "listening_pct": 80,
  "reading_pct": 85,
  "audio_played": true,
  "voice_evaluated": true,
  "conversation_minutes": 3,
  "essential_tasks_passed": true,
  "evidence_note": "慢速自介對話、未見稿音訊、短訊寫作。"
}
```

五項能力各以 0–4 分評分：0 無證據、1 難以完成、2 部分完成但需要大量協助、3 達成本級熟悉任務、4 穩定且自然地完成。升級需每項至少 3 分、合計至少 17／20、聽讀理解各至少 75%、指定任務全數完成。A1 對話至少 3 分鐘、A2 至少 6 分鐘、B1 至少 10 分鐘且應設計成 10–15 分鐘任務。聽力必須先實際播放音訊且不偷看逐字稿；口語互動與發音必須有即時語音或錄音證據。缺少證據標記「待評」，不得解鎖。

| 關卡 | 必測情境與作品 |
| --- | --- |
| A1 | 自我介紹、基本生活、基本問答、基礎文法的實際使用、簡短閱讀、真正的音訊理解、3–8 句寫作。 |
| A2 | 過去經驗、未來計畫、日常對話、短文閱讀、簡單敘事、理由簡單的意見。 |
| B1 | 連續表達、經驗及原因、意見與選擇比較、一般文章、較完整文章、10–15 分鐘對話。 |

測驗題應與上課例句不同。文法與詞彙在理解和輸出中評分，不靠孤立背誦。未通過時，紀錄五項分數與最弱任務，先安排補強，再用新題重測；不能因完成最後單元而自動放行。西文 B1 通過後才能開始義文橋接及 A1。義文三個關卡沿用同一能力標準，並檢查西文干擾是否妨礙義文表達。
