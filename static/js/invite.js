/**
 * Invitation d'un nouveau membre depuis /espace-membre/
 *
 * Appelle POST /api/invite (service invite-api, proxifié par Caddy) avec le
 * JWT Keycloak du membre bureau connecté. L'API vérifie elle-même le rôle
 * 'bureau' côté serveur — le contrôle fait ici n'est qu'un confort d'UI.
 */
(function () {
  'use strict';

  var INVITE_ENDPOINT = '/api/invite';

  var card = document.getElementById('jccInviteCard');
  var modal = document.getElementById('jccInviteModal');
  if (!card || !modal) return;

  var emailInput = document.getElementById('jccInviteEmail');
  var firstInput = document.getElementById('jccInviteFirstName');
  var lastInput = document.getElementById('jccInviteLastName');
  var feedback = document.getElementById('jccInviteFeedback');
  var submitBtn = document.getElementById('jccInviteSubmit');
  var cancelBtn = document.getElementById('jccInviteCancel');

  function showFeedback(message, kind) {
    feedback.textContent = message;
    feedback.className = 'jcc-modal__feedback jcc-modal__feedback--' + kind;
    feedback.style.display = 'block';
  }

  function clearFeedback() {
    feedback.style.display = 'none';
    feedback.textContent = '';
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    cancelBtn.disabled = busy;
    submitBtn.textContent = busy ? 'Envoi…' : "Envoyer l'invitation";
  }

  function openModal() {
    emailInput.value = '';
    firstInput.value = '';
    lastInput.value = '';
    clearFeedback();
    setBusy(false);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    emailInput.focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function submit() {
    var email = emailInput.value.trim();
    if (!email) {
      showFeedback('Veuillez saisir une adresse e-mail.', 'error');
      emailInput.focus();
      return;
    }

    var session = JCC_AUTH.restoreSession();
    if (!session.authenticated || !session.token) {
      showFeedback('Session expirée — reconnectez-vous.', 'error');
      return;
    }

    var payload = { email: email };
    if (firstInput.value.trim()) payload.firstName = firstInput.value.trim();
    if (lastInput.value.trim()) payload.lastName = lastInput.value.trim();

    setBusy(true);
    clearFeedback();

    fetch(INVITE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + session.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json()
          .catch(function () { return {}; })
          .then(function (body) { return { ok: res.ok, status: res.status, body: body }; });
      })
      .then(function (r) {
        setBusy(false);
        if (!r.ok) {
          // FastAPI renvoie le message d'erreur dans "detail"
          showFeedback(r.body.detail || ('Erreur ' + r.status), 'error');
          return;
        }
        showFeedback(r.body.message || 'Invitation envoyée.', 'success');
        emailInput.value = '';
        firstInput.value = '';
        lastInput.value = '';
      })
      .catch(function (err) {
        setBusy(false);
        console.error('Invitation échouée', err);
        showFeedback('Impossible de joindre le service d\'invitation.', 'error');
      });
  }

  card.addEventListener('click', openModal);
  cancelBtn.addEventListener('click', closeModal);
  submitBtn.addEventListener('click', submit);

  // Fermeture au clic sur le fond
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  // Échap = fermer, Entrée = envoyer
  document.addEventListener('keydown', function (e) {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && !submitBtn.disabled) submit();
  });
})();
