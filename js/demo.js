(() => {
  'use strict';
  const config = JSON.parse(document.getElementById('demo-config').textContent);
  const { animals, strings } = config;
  const byId = id => document.getElementById(id);
  const demo = byId('demo');
  const status = byId('audio-status');
  const audio = new Audio();
  audio.preload = 'none';
  let playback = 0;
  let activeButton = null;
  let pendingSound = null;
  function setPlaying(button, playing) {
    if (!button) return;
    button.classList[playing ? 'add' : 'remove']('playing');
    if (button.dataset.animal) button.setAttribute('aria-pressed', String(playing));
  }
  function stop() {
    playback++;
    pendingSound = null;
    audio.pause();
    audio.currentTime = 0;
    setPlaying(activeButton, false);
    activeButton = null;
  }
  function clearStatus() { status.textContent = ''; }
  async function playClip(src, request, fallback = null) {
    audio.src = src;
    try {
      await audio.play();
    } catch {
      if (request !== playback) return;
      if (fallback) {
        // A missing name recording should not prevent the animal sound.
        pendingSound = null;
        return playClip(fallback, request);
      }
      stop();
      status.textContent = strings.audioError;
    }
  }
  function play(animal, button, withName = false) {
    stop();
    clearStatus();
    activeButton = button;
    setPlaying(button, true);
    pendingSound = withName && animal.speech ? animal.sound : null;
    return playClip(pendingSound ? animal.speech : animal.sound, playback, pendingSound);
  }
  audio.addEventListener('ended', () => {
    if (pendingSound) {
      const sound = pendingSound;
      pendingSound = null;
      playClip(sound, playback);
    } else {
      setPlaying(activeButton, false);
      activeButton = null;
    }
  });
  document.querySelectorAll('[data-animal]').forEach(button => {
    button.disabled = false;
    button.addEventListener('click', () => {
      if (activeButton === button) { stop(); clearStatus(); return; }
      play(animals.find(a => a.slug === button.dataset.animal), button, true);
    });
  });
  document.querySelectorAll('.fallback-audio').forEach(control => { control.hidden = true; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (link && link.getAttribute('href') !== '#demo') stop();
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) stop();
  }).observe(demo);

  const quiz = byId('quiz');
  const game = byId('quiz-game');
  const finish = byId('quiz-finish');
  const choices = byId('quiz-choices');
  const next = byId('quiz-next');
  const replay = byId('quiz-replay');
  const feedback = byId('quiz-feedback');
  let targets = [];
  let round = 0;
  let solved = false;
  const shuffle = list => {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  function showRound() {
    solved = false;
    next.hidden = true;
    feedback.textContent = '';
    const number = new Intl.NumberFormat(config.lang);
    byId('quiz-progress').textContent = strings.round.replace('{current}', number.format(round + 1)).replace('{total}', number.format(3));
    choices.replaceChildren();
    const target = targets[round];
    const options = shuffle([target, ...shuffle(animals.filter(a => a.slug !== target.slug)).slice(0, 2)]);
    for (const animal of options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice';
      button.dataset.choice = animal.slug;
      const image = document.createElement('img');
      image.src = animal.image; image.width = 512; image.height = 512; image.alt = '';
      const name = document.createElement('span');
      name.textContent = animal.name;
      button.append(image, name);
      button.addEventListener('click', () => {
        if (solved) return;
        if (animal.slug !== target.slug) {
          feedback.textContent = strings.retry;
          button.classList.add('try-again');
          return;
        }
        solved = true;
        stop();
        feedback.textContent = strings.correct;
        button.classList.add('correct');
        for (const option of choices.children) option.disabled = true;
        next.hidden = false;
        next.focus();
      });
      choices.append(button);
    }
    replay.focus();
    play(target, replay);
  }
  function start() {
    targets = shuffle(animals).slice(0, 3);
    round = 0;
    byId('quiz-start').hidden = true;
    finish.hidden = true;
    game.hidden = false;
    showRound();
  }
  byId('quiz-start').addEventListener('click', start);
  byId('quiz-restart').addEventListener('click', start);
  replay.addEventListener('click', () => play(targets[round], replay));
  next.addEventListener('click', () => {
    if (!solved) return;
    stop(); clearStatus();
    round++;
    if (round === 3) {
      game.hidden = true; finish.hidden = false;
      byId('quiz-complete').focus();
    } else showRound();
  });
  quiz.hidden = false;
})();
