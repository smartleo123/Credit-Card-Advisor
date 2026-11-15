# CardWise TW｜台灣信用卡智慧比較

> 台灣各家信用卡回饋、年費與申辦資格比較。提供消費情境試算、個人持卡清單、點數現值、剩餘加碼上限、年費攤提及官方條款監測。

**網站預定網址：** https://smartleo123.github.io/Credit-Card-Advisor/

**狀態：** 核心 MVP 已建立。來源監測不等於條款自動核實；目前年費和多張卡的申辦門檻仍待逐一查證，不應解讀成完整、即時或保證正確的財務建議。

## 功能

- **熱門信用卡**：玉山 Unicard、國泰世華 CUBE、台北富邦 J 卡、中國信託 LINE Pay、永豐 DAWAY、滙豐 Live+，以及待確認的星展、台新條目。
- **情境試算**：一般、LINE Pay、街口、Apple Pay、蝦皮、momo、便利商店、海外、餐飲與購物。
- **個人條件**：持有卡片、銀行自扣／電子帳單、選擇方案、海外實體消費、新戶資格等。
- **精細比較**：基本與加碼回饋分開估算，按月或帳單週期扣除已使用加碼點數，設定個人點數折現值，扣除海外交易手續費與依刷卡額攤提的年費。
- **申辦資訊**：提供銀行官方申辦與條款連結，明示待核實的年收入、年費與減免方式。
- **優惠期限**：日期過期的加碼不列入比較；45 天內到期自動顯示提醒。
- **個人隱私**：持有卡片、已用額度與資格條件只保存在瀏覽器的 localStorage，不送到伺服器；不同裝置不會自動同步。

## 重要限制

1. **支付方式不是商家類別。** Apple Pay 的回饋通常看商戶類別及銀行認列，第三方支付也可能被排除；各行活動以原始請款資料為準。
2. 超商通常有回饋排除條件，不能把一般消費率直接套用。玉山 Unicard 超商目前保守以零回饋處理；其他卡請核實。
3. 無法自動取得你已經使用的加碼點數額度。請在每張卡「個人設定」欄手動維護；下期請自行歸零。
4. 年費為空代表**待核實**，而非免年費。你可以填入自己實際應付的年度年費；未填時試算不扣年費並顯示警告。
5. 首刷禮依新戶定義、核卡日期、名額與任務認列。**已截止首刷禮只展示歷史資訊，不加入單筆推薦**。
6. 多種加碼可能互斥、共用上限或有特殊計算順序。已實作的方案按規則估算，仍須核對官方條款。
7. GitHub Actions 排程是**盡力執行**，不保證每日固定分鐘；官網反爬蟲或 JS 動態內容可能導致監測失敗。
8. 本站不蒐集個人金融紀錄、不代表銀行，請勿輸入卡號、密碼或敏感個資。

## 本地啟動

因為 `fetch("./data/cards.json")` 會受 `file://` CORS 限制，請使用本機 HTTP 伺服器：

```bash
python3 -m http.server 8000
```

再開啟 http://localhost:8000/

無需 Node.js 或建置程序。

## GitHub Pages 自動部署

1. 進入 Repository → **Settings → Pages**。
2. 在 **Build and deployment → Source** 選擇 **GitHub Actions**。
3. 確保 **Actions → General** 允許必要的 GitHub Actions 執行，並讓工作流程有合理權限。
4. `main` 有新提交時，`.github/workflows/deploy.yml` 會進行基本檔案檢查與 Pages 部署。
5. 於 Actions 中確認 **Deploy website to GitHub Pages** 完成後，再開啟上方網站網址。若出現 404，先檢查 Pages Source、Actions 執行狀態與部署權限。

## 更新資料與監測

- `data/cards.json`：唯一的前端信用卡規則資料來源（含官方來源、條件、回饋上限、期限與查核日期）。
- `scripts/monitor.py`：對每張卡的官方來源網頁計算內容雜湊並比對。
- `.github/workflows/monitor.yml`：每天約台灣時間上午 9:23 排程檢查。若官網有變動或無法連線，建立／追加 GitHub Issue 供人工查核。
- `data/source-status.json`：監測結果，執行後自動生成。

**資料更新流程：** 偵測官方頁面變動 → Issue 待核實 → 人工核對條款 → 更新 `data/cards.json` → 部署網站。**不會抓到新文字就自行推定新優惠率**，避免錯誤推薦。

### 資料規格簡介

每張卡有 `base.rate`（一般消費率）、`rules[]`（符合類別、加碼率、點數上限、週期、資格及截止日）、`fee`、`waiver`、`income`、`reward` 和官方 `source` 等欄位。缺值一律 `null` 或空白表示待核實。條件不可只以「最高 X%」取代詳細規則。

## 官方主要來源

- [玉山 Unicard](https://event.esunbank.com.tw/credit/unicard/index.html)
- [國泰 CUBE](https://www.cathaybk.com.tw/cathaybk/promo/event/credit-card/product/CUBE_rights/)
- [富邦 J 卡](https://www.fubon.com/banking/JF/)
- [中信 LINE Pay 卡](https://www.ctbcbank.com/content/dam/minisite/long/creditcard/LINEPay/notice.html)
- [永豐 DAWAY](https://bank.sinopac.com/sinopacBT/personal/credit-card/introduction/bankcard/DAWAY.html)
- [滙豐 Live+](https://www.hsbc.com.tw/credit-cards/products/liveplus/)

**首次整理日：2026-11-16**。詳細優惠期限與限制請點卡片「官方條款」核對。

## 技術

Vanilla HTML / CSS / JavaScript；GitHub Pages 靜態部署；Python 3 標準函式庫監控；GitHub Actions CI/CD。沒有連結信用卡帳戶或網銀，不需要帳戶金鑰。
