/* sugar-lane · 口令
   口令以加盐哈希存放，页面源码里不会出现明文。
   要换口令：先改下面的 salt，再在浏览器控制台执行
       sugarHashPassword('你的新密码')
   把打印出来的 16 位字符串贴进 passHash。
   密码请用纯英文数字：emoji 这类字符在不同环境的编码方式不一样，算出来的值会对不上。 */
var SUGAR_AUTH = {
  user: 'mupa',
  salt: 'sugar-lane-2026-1107',
  passHash: 'a74aa49adf78e108'
};

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
