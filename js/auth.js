/* sugar-lane · 口令
   口令以加盐哈希存放，页面源码里不会出现明文。
   一个账号一条记录；账号名各不相同，口令可以一样，也可以各用各的。
   要加账号或换口令：在浏览器控制台执行
       sugarHashPassword('你的新密码')
   把打印出来的 16 位字符串贴进对应那条的 passHash。
   口令请用纯英文数字：emoji 这类字符在不同环境的编码方式不一样，算出来的值会对不上。
   改动 salt 会让所有账号的 passHash 一起失效，要换就全部重算。 */
var SUGAR_AUTH = {
  salt: 'sugar-lane-2026-1107',
  accounts: [
    { user: 'wusha', passHash: 'a74aa49adf78e108' },
    { user: 'luoyi', passHash: 'a74aa49adf78e108' }
  ]
};

/* 按账号名取出那一行，没有就返回空 */
function sugarFindAccount(name) {
  var list = SUGAR_AUTH.accounts;
  for (var i = 0; i < list.length; i++) {
    if (list[i].user === name) return list[i];
  }
  return null;
}

/* FNV-1a 64 位，纯 JS 同步实现，不依赖 Web Crypto，任何浏览器都能算 */
function sugarHashPassword(pw) {
  var input = SUGAR_AUTH.salt + '|' + pw + '|' + SUGAR_AUTH.salt;
  var h = 0xcbf29ce484222325n;
  var p = 0x100000001b3n;
  var mask = 0xFFFFFFFFFFFFFFFFn;
  for (var i = 0; i < input.length; i++) {
    h = ((h ^ BigInt(input.charCodeAt(i))) * p) & mask;
  }
  return h.toString(16).padStart(16, '0');
}

/* 其它页面共用这把钥匙：登录成功后写进 sessionStorage */
var SUGAR_KEY = 'sugar-lane:key';
var SUGAR_OPEN = 'open';
/* 登录成功时记下这次是谁进来的，评论和发图要用它当昵称 */
var SUGAR_USER = 'sugar-lane:user';
