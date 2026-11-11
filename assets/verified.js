/* Verified page: point the button to the visitor's kahila, or explain an expired link. */
(function(){var q=new URLSearchParams(location.search),a=q.get('area'),map={netanya:'/netanya/',center:'/center/',jerusalem:'/jerusalem/'};
if(q.get('status')==='invalid'){document.getElementById('vt').textContent='This link has expired.';document.getElementById('vp').textContent='Your email may already be confirmed. If not, please sign up again and use the newest email we send.';}
if(map[a])document.getElementById('va').href=map[a];})();
