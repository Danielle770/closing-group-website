/* The Closing Group — visitor analytics (PostHog, US cloud).
   Loaded on every page. Requests go through our own server at /cgx/ (see server/nginx-closinggroup.conf),
   so the Content-Security-Policy can stay 'self' and privacy blockers don't drop the data.
   Collects: page views and page leaves (with scroll depth), every click and form interaction (autocapture),
   session replays (form inputs masked), heatmaps, dead and rage clicks, web vitals, JavaScript errors,
   traffic source / UTM / referrer, device, browser, country and city, which page sections were seen,
   contact clicks (WhatsApp, phone, email) and the sign-up funnel. Members are linked to their visits by email
   when they join. Visitors can switch this off on /privacy/ (stored in their browser). */
(function () {
  if (window.__cgAnalytics) return;
  window.__cgAnalytics = 1;

  // Official PostHog HTML snippet (queues calls until the SDK has loaded)
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId setPersonProperties".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  var KAHILA = { "/netanya/": "netanya", "/center/": "center", "/jerusalem/": "jerusalem" };
  var ref = "";
  try { ref = new URLSearchParams(location.search).get("ref") || localStorage.getItem("cg_ref") || ""; } catch (e) {}

  // Project token is public by design (it can only send events, not read them)
  posthog.init("phc_m6E2PxnpJHwGjWqu49K3bPZDBF9EuvqGp5DeCsjtdqF4", {
    api_host: location.origin + "/cgx",
    ui_host: "https://us.posthog.com",
    person_profiles: "always",            // a profile for every visitor, not only members
    capture_pageview: true,
    capture_pageleave: true,              // time on page + how far they scrolled
    autocapture: true,                    // clicks, form changes and submits
    rageclick: true,
    capture_dead_clicks: true,
    enable_heatmaps: true,
    capture_performance: { web_vitals: true },
    capture_exceptions: true,
    enable_recording_console_log: true,
    session_recording: {
      maskAllInputs: true,                // names, emails and phone numbers are never shown in replays
      recordCrossOriginIframes: false
    },
    persistence: "localStorage+cookie",
    loaded: function (ph) {
      ph.register({
        site: "closinggroupisrael.com",
        page_kahila: KAHILA[location.pathname] || null,
        referral_leader: ref || null,
        browser_language: navigator.language || null,
        screen_size: screen.width + "x" + screen.height,
        reduced_motion: !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches),
        dark_mode: !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches)
      });
      if (ref) ph.register_once({ first_referral_leader: ref });
    }
  });

  function track(ev, props) { try { posthog.capture(ev, props || {}); } catch (e) {} }

  document.addEventListener("DOMContentLoaded", function () {
    // Contact clicks: WhatsApp, phone, email, and links that leave the site
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      var h = a.getAttribute("href") || "", type = null;
      if (/wa\.me|whatsapp/i.test(h)) type = "whatsapp";
      else if (h.indexOf("tel:") === 0) type = "phone";
      else if (h.indexOf("mailto:") === 0) type = "email";
      if (type) track("contact_clicked", { method: type, link_text: (a.textContent || "").trim().slice(0, 80) });
      else if (a.host && a.host !== location.host) track("outbound_link_clicked", { url: a.href, link_text: (a.textContent || "").trim().slice(0, 80) });
    }, true);

    // Sign-up funnel: started typing in a form (once per form per page)
    document.querySelectorAll("form").forEach(function (form, i) {
      var started = false;
      form.addEventListener("focusin", function () {
        if (started) return; started = true;
        track("signup_form_started", { form_area: form.getAttribute("data-area") || "home", form_index: i });
      });
    });

    // Which page sections people actually reached
    if ("IntersectionObserver" in window) {
      var seen = {};
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var id = en.target.id || en.target.getAttribute("aria-label") || (en.target.querySelector("h1,h2") || {}).textContent;
          id = (id || "").trim().slice(0, 60);
          if (!id || seen[id]) return;
          seen[id] = 1;
          track("section_viewed", { section: id });
          io.unobserve(en.target);
        });
      }, { threshold: 0.4 });
      document.querySelectorAll("main section, main [id]").forEach(function (s) { io.observe(s); });
    }

    // Opt-out / opt-in control on the privacy page
    var box = document.getElementById("cg-analytics-choice");
    if (box) {
      var status = box.querySelector(".cg-analytics-status"), btn = box.querySelector("button");
      function paint() {
        var off = false; try { off = posthog.has_opted_out_capturing(); } catch (e) {}
        status.textContent = off ? "Analytics is switched OFF in this browser." : "Analytics is switched ON in this browser.";
        btn.textContent = off ? "Switch analytics on" : "Switch analytics off";
      }
      btn.addEventListener("click", function () {
        var off = false; try { off = posthog.has_opted_out_capturing(); } catch (e) {}
        try { off ? posthog.opt_in_capturing() : posthog.opt_out_capturing(); } catch (e) {}
        paint();
      });
      // wait for the SDK so the status is accurate
      var tries = 0; (function wait() { if (posthog.__loaded || tries++ > 40) paint(); else setTimeout(wait, 150); })();
    }
  });

  // Called by the sign-up and chat scripts
  window.cgAnalytics = {
    member: function (d) {
      try {
        var email = String(d.email || "").trim().toLowerCase();
        if (!email) return;
        posthog.identify(email, {
          email: email, name: d.full_name || null, whatsapp: d.whatsapp || null,
          country_city: d.country_city || null, community: d.community || null,
          kahila: d.area || null, referred_by: d.referred_by || d.ref || null,
          alerts_consent: d.consent_alerts === true, is_member: true
        }, { joined_on_page: location.pathname, first_kahila: d.area || null });
      } catch (e) {}
    },
    inquiry: function (d) {
      try { posthog.setPersonProperties({ name: d.full_name || null, whatsapp: d.whatsapp || null, asked_a_question: true }); } catch (e) {}
    },
    track: track
  };
})();
