/* Verified page: point the button to the visitor's kahila, or explain an expired link. */
(function(){var q=new URLSearchParams(location.search),a=q.get('area'),fr=/^fr/i.test(document.documentElement.lang||''),P=fr?'/fr':'',map={netanya:P+'/netanya/',center:P+'/center/',jerusalem:P+'/jerusalem/'};
if(q.get('status')==='invalid'){document.getElementById('vt').textContent=fr?'Ce lien a expir\u00e9.':'This link has expired.';document.getElementById('vp').textContent=fr?'Votre e-mail est peut-\u00eatre d\u00e9j\u00e0 confirm\u00e9. Sinon, veuillez vous inscrire \u00e0 nouveau et utiliser le dernier e-mail que nous vous envoyons.':'Your email may already be confirmed. If not, please sign up again and use the newest email we send.';}
if(map[a])document.getElementById('va').href=map[a];
if(map[a]&&q.get('status')!=='invalid'){try{window.cgMember&&window.cgMember.remember(a,'');}catch(e){}}})();
