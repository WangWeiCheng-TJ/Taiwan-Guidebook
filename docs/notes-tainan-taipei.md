# 待整理：台南沙茶火鍋與台北交通細節

記錄日期：2026-10-11。整理前先不改資料檔。

## 1. 台南：小豪洲沙茶火鍋

- 已加入 `data/food/tainan.json`（`id: xiao-hao-zhou-satay-hotpot`，`kind: hotpot`，`local: true`）。
- 來源：魚冊推薦（尚未查證，repo 內沒有此來源的連結或內容）。
- 待確認：「豬肉比較好吃」這個說法。找到魚冊原文後，再決定是否加成 `hint`（需附來源）。
- 打包檔 `app/data/guidebook.json` 尚未重建，需要執行 `scripts/build_dataset.py`。

## 2. 台北：優先捷運、才搭公車

- 尚未決定放哪裡。
- 候選 A：[data/tips.json](../data/tips.json) 新增一則交通提示（`category: transport`）。
- 候選 B：改寫台北景點的 `transportation_zh`，例如 [九份](../data/attractions/jiufen-gold-mountain.json)、[淡水紅毛城](../data/attractions/fort-san-domingo.json)、[迪化街](../data/attractions/dadaocheng-dihua-street.json)。這三個景點目前都已是捷運在前、公車在後，補充時要避免重複。
- 待確認：要用哪一種、要套用到哪些地方。
