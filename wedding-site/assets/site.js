/* ============ Sanjula & Tasos — site behaviour ============ */

/* ---- cover photo flip ---- */
(function(){
  var frames = [
    './assets/photos/athens-couple.jpg','./assets/photos/windsor.jpg','./assets/photos/taj.jpg',
    './assets/photos/paris.jpg','./assets/photos/london-church.jpg','./assets/photos/india-temple.jpg'
  ];
  var inner = document.getElementById('flipInner');
  var front = document.getElementById('faceFront');
  var back  = document.getElementById('faceBack');
  if(!inner || !front || !back) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rot = 0, next = 2;
  front.src = frames[0]; back.src = frames[1];
  function tick(){
    if(reduce){ front.src = frames[next]; next = (next+1) % frames.length; return; }
    rot += 180;
    inner.style.transform = 'rotateX('+rot+'deg)';
    setTimeout(function(){
      var showingBack = ((rot/180) % 2) === 1;
      if(showingBack){ front.src = frames[next]; } else { back.src = frames[next]; }
      next = (next+1) % frames.length;
    }, 950);
  }
  setInterval(tick, 3400);
})();

/* ---- nav solid on scroll ---- */
(function(){
  var nav = document.getElementById('nav');
  if(!nav) return;
  function onScroll(){ nav.classList.toggle('solid', (window.scrollY||window.pageYOffset) > 40); }
  onScroll(); window.addEventListener('scroll', onScroll, {passive:true});
})();

/* ---- polaroid music player (scroll-start, low volume, live EQ) ---- */
(function(){
  var audio = document.getElementById('song');
  var player = document.getElementById('player');
  var btn = document.getElementById('ppBtn');
  var eq = document.getElementById('ppEq');
  if(!audio || !player || !btn) return;

  var ytId = (player.getAttribute('data-yt') || '').trim();
  var userPaused = false;     // set true only when the guest explicitly pauses
  var bars = eq ? eq.querySelectorAll('span') : [];

  /* ============ YOUTUBE PATH (licensed official embed, soft autoplay) ============ */
  if(ytId){
    var yt, ytReady = false, SOFT = 12;

    function initYT(){
      yt = new YT.Player('ytHost', {
        videoId: ytId,
        playerVars: {autoplay:1, controls:0, disablekb:1, loop:1, playlist:ytId, modestbranding:1, playsinline:1, rel:0},
        events: {
          onReady: function(){
            ytReady = true;
            try{ yt.setVolume(SOFT); yt.mute(); yt.playVideo(); }catch(e){}   // muted autoplay is allowed
          },
          onStateChange: function(ev){
            if(ev.data === YT.PlayerState.PLAYING){ player.classList.add('playing'); }
            else if(ev.data === YT.PlayerState.PAUSED || ev.data === YT.PlayerState.ENDED){ player.classList.remove('playing'); }
          }
        }
      });
    }
    if(window.YT && window.YT.Player){ initYT(); }
    else {
      window.onYouTubeIframeAPIReady = initYT;
      var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }

    function softOn(){ if(!ytReady) return; try{ yt.unMute(); yt.setVolume(SOFT); yt.playVideo(); }catch(e){} }

    // bring the sound in softly on the first interaction anywhere (except the button)
    var unmuted = false;
    function firstGestureY(ev){
      if(ev && player.contains(ev.target)) return;
      if(userPaused){ cleanupY(); return; }
      unmuted = true; softOn(); cleanupY();
    }
    function cleanupY(){
      window.removeEventListener('scroll', firstGestureY);
      window.removeEventListener('touchstart', firstGestureY);
      window.removeEventListener('pointerdown', firstGestureY);
      window.removeEventListener('keydown', firstGestureY);
    }
    window.addEventListener('scroll', firstGestureY, {passive:true});
    window.addEventListener('touchstart', firstGestureY, {passive:true});
    window.addEventListener('pointerdown', firstGestureY);
    window.addEventListener('keydown', firstGestureY);

    // button: pause / resume (soft, audible)
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var playing = false;
      try{ playing = ytReady && yt.getPlayerState() === YT.PlayerState.PLAYING; }catch(err){}
      if(playing){ userPaused = true; try{ yt.pauseVideo(); }catch(err){} }
      else { userPaused = false; unmuted = true; softOn(); }
    });
    return;
  }

  /* ============ LOCAL AUDIO PATH (live frequency analyser) ============ */
  audio.volume = 0.18;
  var ac, analyser, srcNode, data, raf;

  function setupAnalyser(){
    if(ac) return;
    try{
      var AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      ac = new AC();
      srcNode = ac.createMediaElementSource(audio);
      analyser = ac.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.78;
      srcNode.connect(analyser);
      analyser.connect(ac.destination);
      data = new Uint8Array(analyser.frequencyBinCount);
    }catch(e){ /* analyser optional */ }
  }

  function drawEq(){
    if(!analyser || audio.paused){ raf = null; eq && eq.classList.remove('live'); return; }
    analyser.getByteFrequencyData(data);
    eq.classList.add('live');
    var n = bars.length, step = Math.max(1, Math.floor(data.length / n));
    for(var i=0;i<n;i++){
      var v = data[i*step] || 0;            // 0..255
      var h = 14 + (v/255)*86;              // 14%..100%
      bars[i].style.setProperty('--h', h.toFixed(0)+'%');
    }
    raf = requestAnimationFrame(drawEq);
  }

  function play(){
    if(!audio.getAttribute('src')){ audio.src = audio.getAttribute('data-src') || ''; }
    setupAnalyser();
    if(ac && ac.state === 'suspended'){ ac.resume(); }
    var p = audio.play();
    if(p && p.then){
      p.then(function(){
        player.classList.add('playing');
        if(!raf) raf = requestAnimationFrame(drawEq);
      }).catch(function(){
        /* no audio file yet, or blocked — keep UI idle */
      });
    } else {
      player.classList.add('playing');
      if(!raf) raf = requestAnimationFrame(drawEq);
    }
  }
  function pause(){
    audio.pause();
    player.classList.remove('playing');
    if(raf){ cancelAnimationFrame(raf); raf = null; }
    if(eq) eq.classList.remove('live');
  }

  btn.addEventListener('click', function(){
    if(audio.paused){ userPaused = false; play(); }
    else { userPaused = true; pause(); }
  });

  audio.addEventListener('ended', function(){ player.classList.remove('playing'); });

  // start gently on the guest's first interaction (scroll / tap / click)
  var started = false;
  function firstGesture(){
    if(started || userPaused) { cleanup(); return; }
    started = true;
    play();
    cleanup();
  }
  function cleanup(){
    window.removeEventListener('scroll', firstGesture);
    window.removeEventListener('touchstart', firstGesture);
    window.removeEventListener('pointerdown', firstGesture);
    window.removeEventListener('keydown', firstGesture);
  }
  window.addEventListener('scroll', firstGesture, {passive:true, once:false});
  window.addEventListener('touchstart', firstGesture, {passive:true});
  window.addEventListener('pointerdown', firstGesture);
  window.addEventListener('keydown', firstGesture);
})();

/* ---- scroll reveal ---- */
(function(){
  var els = document.querySelectorAll('.reveal, .story');
  if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in');});return;}
  var io = new IntersectionObserver(function(es){
    es.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target);} });
  }, {threshold:.16, rootMargin:'0px 0px -8% 0px'});
  els.forEach(function(e){ if(!e.classList.contains('in')) io.observe(e); });
})();

/* ---- scattered-photo parallax (desktop) ---- */
(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce) return;
  var items = [].slice.call(document.querySelectorAll('.scatter[data-par]'));
  if(!items.length) return;
  var ticking = false;
  function update(){
    ticking = false;
    if(window.innerWidth < 821) return;
    var vh = window.innerHeight;
    items.forEach(function(el){
      var r = el.getBoundingClientRect();
      var center = r.top + r.height/2;
      var prog = (center - vh/2) / vh;           // -1..1 around viewport centre
      var p = parseFloat(el.getAttribute('data-par')) || 0;
      el.style.transform = 'translateY(' + (prog * p * -40).toFixed(1) + 'px)';
    });
  }
  window.addEventListener('scroll', function(){ if(!ticking){ ticking = true; requestAnimationFrame(update); } }, {passive:true});
  window.addEventListener('resize', update);
  update();
})();

/* ---- draw thread length ---- */
(function(){
  var p = document.getElementById('threadPath');
  if(p){ p.style.setProperty('--len', Math.ceil(p.getTotalLength())); }
})();

/* ---- dual countdowns ---- */
(function(){
  var targets = [
    {el:'cd-chd', date:new Date('2027-02-25T00:00:00')},
    {el:'cd-ath', date:new Date('2027-10-03T00:00:00')}
  ];
  function pad(n){ return n < 10 ? '0'+n : ''+n; }
  function render(){
    var now = new Date();
    targets.forEach(function(t){
      var root = document.getElementById(t.el); if(!root) return;
      var diff = t.date - now;
      if(diff <= 0){
        var passed = root.querySelector('.cd-passed'), clock = root.querySelector('.cd-clock');
        if(clock) clock.style.display='none'; if(passed) passed.style.display='block'; return;
      }
      var s=Math.floor(diff/1000), d=Math.floor(s/86400); s-=d*86400;
      var h=Math.floor(s/3600); s-=h*3600; var m=Math.floor(s/60); s-=m*60;
      root.querySelector('[data-u=d]').textContent=d;
      root.querySelector('[data-u=h]').textContent=pad(h);
      root.querySelector('[data-u=m]').textContent=pad(m);
      root.querySelector('[data-u=s]').textContent=pad(s);
    });
  }
  render(); setInterval(render, 1000);
})();

/* ---- RSVP -> Formspree ---- */
(function(){
  var ENDPOINT='https://formspree.io/f/xzdlpdrv';
  var form=document.getElementById('rsvpForm'); if(!form) return;
  var card=document.getElementById('rsvpCard');
  var STORE='std-rsvp-v1';
  var MAX=4;
  var countEl=document.getElementById('guestCount'), namesWrap=document.getElementById('guestNames'), count=0;
  var chd=form.querySelector('[name=chd]'), ath=form.querySelector('[name=ath]'), cant=form.querySelector('[name=cant]');

  function renderGuests(){
    countEl.textContent=count; var have=namesWrap.children.length;
    if(count>have){ for(var i=have;i<count;i++){ var inp=document.createElement('input');
      inp.className='txt'; inp.type='text'; inp.placeholder='Guest '+(i+1)+' name'; inp.setAttribute('data-guest','1'); namesWrap.appendChild(inp);} }
    else if(count<have){ for(var j=have;j>count;j--){ namesWrap.removeChild(namesWrap.lastChild);} }
  }
  document.getElementById('gMinus').addEventListener('click',function(){ if(count>0){count--;renderGuests();persist();} });
  document.getElementById('gPlus').addEventListener('click',function(){ if(count<MAX){count++;renderGuests();persist();} });

  // "Can't make it" is exclusive
  cant.addEventListener('change',function(){ if(cant.checked){ chd.checked=false; ath.checked=false; } persist(); });
  chd.addEventListener('change',function(){ if(chd.checked) cant.checked=false; persist(); });
  ath.addEventListener('change',function(){ if(ath.checked) cant.checked=false; persist(); });

  function collect(){
    var gn=[].map.call(namesWrap.querySelectorAll('[data-guest]'),function(i){return i.value.trim();});
    return {name:form.querySelector('[name=name]').value.trim(),
      chd:chd.checked, ath:ath.checked, cant:cant.checked, guests:count, guestNames:gn};
  }
  function persist(){ try{ localStorage.setItem(STORE, JSON.stringify(collect())); }catch(e){} }
  function restore(){
    try{ var s=JSON.parse(localStorage.getItem(STORE)||'null'); if(!s) return;
      if(s.name) form.querySelector('[name=name]').value=s.name;
      chd.checked=!!s.chd; ath.checked=!!s.ath; cant.checked=!!s.cant;
      count=Math.min(s.guests||0,MAX); renderGuests();
      if(s.guestNames){ var ins=namesWrap.querySelectorAll('[data-guest]'); s.guestNames.forEach(function(n,i){ if(ins[i]) ins[i].value=n; }); }
    }catch(e){}
  }
  form.addEventListener('input', persist);

  form.addEventListener('submit', function(e){
    e.preventDefault(); var d=collect();
    if(!d.name){ form.querySelector('[name=name]').focus(); return; }
    if(!d.chd && !d.ath && !d.cant){ return; }
    persist();
    var payload={
      Name: d.name,
      Chandigarh: d.chd ? 'Yes' : 'No',
      Athens: d.ath ? 'Yes' : 'No',
      "Can't make it": d.cant ? 'Yes' : 'No',
      Guests: d.guests,
      "Guest names": d.guestNames.filter(Boolean).join(', ')
    };
    var btn=form.querySelector('.submit'); if(btn){ btn.disabled=true; btn.textContent='Sending…'; }
    fetch(ENDPOINT, {method:'POST', headers:{'Accept':'application/json','Content-Type':'application/json'}, body:JSON.stringify(payload)})
      .catch(function(){})
      .then(function(){ card.classList.add('done'); })
      .then(function(){ if(btn){ btn.disabled=false; btn.textContent='Send our RSVP'; } });
  });

  var again=document.getElementById('rsvpAgain');
  if(again) again.addEventListener('click', function(){ card.classList.remove('done'); });

  restore();
})();
