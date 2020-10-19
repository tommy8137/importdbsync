# decimal config readme

小數位數設定檔模組，用於集中管理小數點顯示後幾位。

## 設定內容

**local 設定**
```javascript=
decimalModuleConfig:{
    'enableAutoUpdate': true, // 是否啟用自動更新
    'syncSeconds': 10, // 自動更新間隔(秒)
    'defaultDecimal': 5, // 無法讀取database時的預設值
  }
```
---
**小數設定儲存於 wiprocurement.decimal_config**
以下為內容範例
id |category |parameter_name           |value|remark                        |
---|---------|-------------------------|-----|------------------------------|
  1|MEBom    |default                  |    5|                              |
  2|MEBom    |lastPrice                |    5|                              |
  3|MEBom    |cleanSheetCost           |    5|                              |
 20|Database |default                  |    4|                              |
 21|Database |price                    |    8|last current next 讀取限制     |
 
 **<span style="color:red">防呆邏輯</span>**
 1. 當讀取的 parameter_name 不存在，會自動讀取該 category 的 'default'
 例：讀取(Database, lastPrice) 會得到 (Database, default) => 4
 
2. 當讀取的 category 不存在，會自動讀取 local 的預設值
 例：讀取(NotExist, lastPrice) 會得到 defaultDecimal => 5
 

## 使用方式
模組為 singleton (單例模式)
第一次require 後初始化
初始化需要時間，如果在還沒初始化完成就存取，會得到local設定中的預設值。

**直接使用**
```javascript=
const { formatFloat } = require('../../helpers/utils.js')
const { decimalConfig } = require('../../utils/decimalConfig/index.js') // path 僅供參考

function main(){
    let float = 0.123456789
    float = formatFloat(float, decimalConfig.get('MEBom', 'default'))
}
setTimeout(() => {
  main()
}, 1000)
```

**使用DecimalGetter**
```javascript=
const { formatFloat } = require('../../helpers/utils.js')
const { DecimalGetter } = require('../../utils/decimalConfig/index.js') // path 僅供參考
const meFloatPoint = new DecimalGetter('MEBom')

function main(){
    let float = 0.123456789
    float = formatFloat(float, meFloatPoint.get('default'))
}
setTimeout(() => {
  main()
}, 1000)
```

**<span style="color:red">錯誤示範</span>**
```javascript=
const { formatFloat } = require('../../helpers/utils.js')
const { decimalConfig } = require('../../utils/decimalConfig/index.js') // path 僅供參考
const FLOAT_POINT = decimalConfig.get('MEBom', 'default') // 會得到local設定中的預設值

function main(){
    let float = 0.123456789
    float = formatFloat(float, FLOAT_POINT)
}
setTimeout(() => {
  main()
}, 1000)
```