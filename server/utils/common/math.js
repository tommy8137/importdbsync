
/**
 * return 小數點N位
 * @param {*} value 需要轉換的數字
 * @param {*} n 取小數點第幾位
 */
function fixedPoint(value, n) {
  return Math.round(value * Math.pow(10, n)) / Math.pow(10, n)
}

module.exports = {
  fixedPoint,
}
