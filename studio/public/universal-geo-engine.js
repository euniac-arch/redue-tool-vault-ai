/*!
 * REDUE Universal GEO Engine v3
 * Client-side Schema Injector — auto-extracts taxID / fax / representative / telephone /
 * streetAddress from the page footer and injects Organization + WebSite + WebPage +
 * BreadcrumbList + Person JSON-LD. Also inserts <link rel="help" href="/llms.txt">.
 * Install (hosted): <script src="https://<your-redue-domain>/universal-geo-engine.js" defer></script>
 * Optional overrides (set before this script): window.REDUE_CONFIG = { orgType, name, logo,
 * telephone, taxID, faxNumber, streetAddress, latitude, longitude, sameAs, services,
 * repName, repTitle, pageType, enableAutoDetect }
 * Backward compatible: window.__REDUE_GEO_CONFIG__ is still read and merged.
 *
 * GENERATED FILE — do not edit directly. Source: lib/solve/universal-geo-engine.ts
 * Regenerate: npx tsx scripts/emit-universal-geo-engine.ts
 */
(function () {
  'use strict';
  try {
    if (window.__REDUE_SCHEMA_INJECTED__) { return; }
    window.__REDUE_SCHEMA_INJECTED__ = true;
    if (document.getElementById('redue-universal-schema')) { return; }

    var TAX_ID_RE = /(?:사업자\s*(?:등록)?\s*번호|사업자번호|등록번호|사업자)\s*[:：]?\s*([0-9]{3}-[0-9]{2}-[0-9]{5}|[0-9]{10})/i;
    var FAX_RE = /(?:팩스|FAX|Fax|F\.)\s*[:：]?\s*([0-9]{2,4}-[0-9]{3,4}-[0-9]{4})/i;
    var REP_NAME_RE = /(?:대표자|대표원장|대표이사|원장|대표(?!번호|전화|제품))\s*[:：]?\s*([가-힣]{2,4}|[A-Za-z\s]{2,20})(?=\s|<|$|\||\/)/i;
    var REP_NAME_HALLUCINATION_RE = /^(?:인사말|안내|고객센터|오시는길|바로가기|더보기|자세히보기|이사회|이사|제품으로|제품|대표|문의|상담|진료|정보)$/;
    var TEL_RE = /(?:대표번호|대표전화|전화번호|고객센터|TEL|Tel|T\.?)\s*[:：]?\s*([0-9]{2,4}-[0-9]{3,4}-[0-9]{4}|1[568][0-9]{2}-[0-9]{4})/i;
    var STREET_RE = /(?:주소|위치|소재지)?\s*[:：]?\s*([가-힣]+(?:특별시|광역시|도|시|군|구)\s+[가-힣0-9\s·\-\(\),]+(?:로|길|동|리|가|번지|호|층|관|빌딩|호텔)[가-힣0-9\s·\-\(\),]*)/i;
    var MAP_HOST_RE = /m\.place\.naver\.com|place\.naver\.com|map\.naver\.com|place\.map\.kakao\.com|maps\.google\.com|goo\.gl\/maps/i;
    var SNS_HOST_RE = /blog\.naver\.com|cafe\.naver\.com|post\.naver\.com|in\.naver\.com|instagram\.com|youtube\.com|facebook\.com|tiktok\.com|twitter\.com|x\.com|linkedin\.com/i;
    var SHARE_EXCLUDE_RE = /sharer\.php|\/share(?:r)?(?:[?/]|$)|intent\/tweet|[?&](?:u|url)=/i;
    var DEFAULTS = {"orgType":["Organization","LocalBusiness"],"name":"","logo":"","taxId":"","repName":"","repTitle":"","telephone":"","faxNumber":"","streetAddress":"","addressLocality":"","addressRegion":"","postalCode":"","addressCountry":"KR","latitude":"","longitude":"","placeUrl":"","sameAs":[],"snsUrls":[],"services":[],"serviceCatalog":[],"pageType":"","enableAutoDetect":true};
    var MEDICAL_ORG = ["MedicalClinic","Physician","Hospital","Dentist","VeterinaryCare","Pharmacy","MedicalBusiness"];
    var CATALOG_NAME = "주요 서비스 및 진료 카탈로그";

    function isObj(v) { return v && typeof v === 'object'; }
    function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }
    function copy(dst, src) {
      if (!isObj(src)) return dst;
      for (var k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) dst[k] = src[k];
      }
      return dst;
    }
    function pick(obj, keys) {
      for (var i = 0; i < keys.length; i++) {
        var v = obj[keys[i]];
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return '';
    }
    function setIf(obj, key, val) {
      if (val === undefined || val === null) return;
      if (typeof val === 'string') {
        val = trim(val);
        if (!val) return;
      } else if (Object.prototype.toString.call(val) === '[object Array]' && val.length === 0) {
        return;
      }
      obj[key] = val;
    }
    function firstRe(re, text) {
      var m = re.exec(String(text || ''));
      return m ? trim(m[1]) : '';
    }
    function inList(list, value) {
      for (var i = 0; i < list.length; i++) { if (list[i] === value) return true; }
      return false;
    }
    function isMedical(types) {
      if (!types) return false;
      for (var i = 0; i < types.length; i++) { if (inList(MEDICAL_ORG, types[i])) return true; }
      return false;
    }

    var userCfg = {};
    if (isObj(window.__REDUE_GEO_CONFIG__)) copy(userCfg, window.__REDUE_GEO_CONFIG__);
    if (isObj(window.REDUE_CONFIG)) copy(userCfg, window.REDUE_CONFIG);

    var cfg = {};
    copy(cfg, DEFAULTS);
    copy(cfg, userCfg);
    if (!cfg.taxId) cfg.taxId = pick(userCfg, ['taxID', 'taxId']);
    if (!cfg.telephone) cfg.telephone = pick(userCfg, ['telephone', 'tel']);
    if (!cfg.faxNumber) cfg.faxNumber = pick(userCfg, ['faxNumber', 'fax']);
    if (!cfg.streetAddress) cfg.streetAddress = pick(userCfg, ['streetAddress', 'address']);
    if (!cfg.latitude) cfg.latitude = pick(userCfg, ['latitude', 'lat']);
    if (!cfg.longitude) cfg.longitude = pick(userCfg, ['longitude', 'lng']);
    if (!cfg.logo) cfg.logo = pick(userCfg, ['logo', 'logoUrl']);
    if (!cfg.name) cfg.name = pick(userCfg, ['name', 'siteName', 'legalName']);
    if ((!cfg.sameAs || !cfg.sameAs.length) && userCfg.snsUrls && userCfg.snsUrls.length) {
      cfg.sameAs = userCfg.snsUrls;
    }
    if (cfg.enableAutoDetect === undefined || cfg.enableAutoDetect === null) cfg.enableAutoDetect = true;

    function textOf(el) {
      try { return (el && (el.innerText || el.textContent)) || ''; } catch (e) { return ''; }
    }

    function footerScopeText() {
      var selectors = ['footer', '.footer', '#footer', '[class*="footer"]', '[id*="footer"]', 'address'];
      var text = '';
      var seen = [];
      for (var i = 0; i < selectors.length; i++) {
        var nodes;
        try { nodes = document.querySelectorAll(selectors[i]); } catch (e1) { continue; }
        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          if (inList(seen, node)) continue;
          seen.push(node);
          text += ' ' + textOf(node);
        }
      }
      if (!trim(text) && document.body) text = textOf(document.body);
      return text;
    }

    function extractRepName(text) {
      var re = new RegExp(REP_NAME_RE.source, 'gi');
      var m;
      while ((m = re.exec(text))) {
        var candidate = trim(m[1] || '');
        if (candidate && !REP_NAME_HALLUCINATION_RE.test(candidate)) { return candidate; }
        if (m[0].length === 0) { re.lastIndex += 1; }
      }
      return '';
    }

    function classifyLink(href) {
      var url = String(href || '');
      if (!url || SHARE_EXCLUDE_RE.test(url)) { return null; }
      if (MAP_HOST_RE.test(url)) { return 'map'; }
      if (SNS_HOST_RE.test(url)) { return 'sns'; }
      return null;
    }

    function dedupe(urls) {
      var seen = {};
      var out = [];
      for (var i = 0; i < urls.length; i++) {
        var u = trim(urls[i] || '');
        if (!u) continue;
        var key = u.replace(/\/+$/, '').toLowerCase();
        if (seen[key]) continue;
        seen[key] = true;
        out.push(u);
      }
      return out;
    }

    function absUrl(href, origin) {
      var h = trim(href);
      if (!h || h.charAt(0) === '#') return '';
      if (/^https?:\/\//i.test(h)) return h.replace(/#.*$/, '');
      if (h.indexOf('//') === 0) return (location.protocol || 'https:') + h.replace(/#.*$/, '');
      if (h.charAt(0) === '/') return origin + h.replace(/#.*$/, '');
      var path = location.pathname || '/';
      var dir = origin + path.replace(/\/[^\/]*$/, '/');
      return (dir + h.replace(/^\.\//, '')).replace(/#.*$/, '');
    }

    function mergeExistingOrganization(orgNode) {
      var scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var s = 0; s < scripts.length; s++) {
        if (scripts[s].id === 'redue-universal-schema') continue;
        try {
          var parsed = JSON.parse(scripts[s].textContent || '{}');
          var nodes = parsed['@graph'] ? parsed['@graph'] : [parsed];
          if (Object.prototype.toString.call(nodes) !== '[object Array]') nodes = [nodes];
          for (var n = 0; n < nodes.length; n++) {
            var node = nodes[n];
            if (!isObj(node)) continue;
            var types = node['@type'];
            types = Object.prototype.toString.call(types) === '[object Array]' ? types : [types];
            if (!inList(types, 'Organization') && !inList(types, 'LocalBusiness') && !inList(types, 'MedicalClinic')) continue;
            for (var key in node) {
              if (Object.prototype.hasOwnProperty.call(node, key) && orgNode[key] === undefined) {
                orgNode[key] = node[key];
              }
            }
          }
        } catch (e2) { /* ignore malformed existing JSON-LD */ }
      }
    }

    function injectLlmsHelpLink() {
      var exist = document.querySelector('link[rel="help"][title="LLMs Context"], link[rel="help"][href*="llms.txt"]');
      if (exist) return;
      var link = document.createElement('link');
      link.rel = 'help';
      link.href = '/llms.txt';
      link.title = 'LLMs Context';
      (document.head || document.documentElement).appendChild(link);
    }

    function parseBreadcrumbDom(origin, pageUrl, pageName) {
      var selectors = ['.breadcrumb', '#breadcrumb', '.location', '.path', '[class*="breadcrumb"]', '[class*="location"]', 'nav[aria-label="breadcrumb"]'];
      var root = null;
      for (var i = 0; i < selectors.length; i++) {
        try { root = document.querySelector(selectors[i]); } catch (e3) { root = null; }
        if (root) break;
      }
      if (!root) return [];
      var items = [];
      var links = root.getElementsByTagName('a');
      for (var j = 0; j < links.length; j++) {
        var name = trim(textOf(links[j]).replace(/\s+/g, ' ')).replace(/^[>\/\|\s]+|[>\/\|\s]+$/g, '');
        if (!name) continue;
        var href = absUrl(links[j].getAttribute('href') || '', origin);
        var crumb = { '@type': 'ListItem', position: items.length + 1, name: name };
        if (href) crumb.item = href;
        items.push(crumb);
      }
      if (items.length && pageName && items[items.length - 1].name !== pageName) {
        items.push({ '@type': 'ListItem', position: items.length + 1, name: pageName, item: pageUrl });
      }
      return items;
    }

    function fallbackCrumbs(isHome, origin, pageUrl, homeName, pageName) {
      if (isHome) {
        return [{ '@type': 'ListItem', position: 1, name: homeName || '홈', item: origin + '/' }];
      }
      return [
        { '@type': 'ListItem', position: 1, name: '홈', item: origin + '/' },
        { '@type': 'ListItem', position: 2, name: pageName || homeName || '홈', item: pageUrl }
      ];
    }

    function normalizeServices(raw, orgTypes) {
      var fallbackType = isMedical(orgTypes) ? 'MedicalProcedure' : 'Service';
      var out = [];
      if (!raw || !raw.length) return out;
      var seen = {};
      for (var i = 0; i < raw.length; i++) {
        var item = raw[i];
        var n = '';
        var explicit = '';
        if (typeof item === 'string') {
          n = trim(item);
        } else if (isObj(item)) {
          n = trim(item.name);
          explicit = trim(item.type) || trim(item['@type']);
        }
        if (!n) continue;
        var key = n.toLowerCase();
        if (seen[key]) continue;
        seen[key] = 1;
        var node = {
          '@type': (explicit === 'MedicalProcedure' || explicit === 'Service') ? explicit : fallbackType,
          name: n
        };
        if (isObj(item)) {
          if (item.category) node.category = trim(item.category);
          if (item.description) node.description = trim(item.description);
          if (item.url) node.url = trim(item.url);
        }
        out.push(node);
      }
      return out;
    }

    function run() {
      if (document.getElementById('redue-universal-schema')) { return; }

      var footerText = footerScopeText();
      var auto = cfg.enableAutoDetect !== false;

      function isDummyDigits(raw) {
        var digits = String(raw || '').replace(/\D/g, '');
        if (!digits) return true;
        if (/^0+$/.test(digits) || /^(\d)\1+$/.test(digits)) return true;
        var hyphen = String(raw || '').replace(/\s+/g, '');
        return hyphen === '050-0000-0000' || hyphen === '02-0000-0000' || hyphen === '000-00-00000' || hyphen === '111-11-11111';
      }
      function acceptTaxId(raw) {
        var v = trim(raw);
        if (!v || isDummyDigits(v)) return '';
        var digits = v.replace(/\D/g, '');
        if (digits.length !== 10) return '';
        return digits.slice(0, 3) + '-' + digits.slice(3, 5) + '-' + digits.slice(5);
      }
      var taxId = acceptTaxId(trim(cfg.taxId) || (auto ? firstRe(TAX_ID_RE, footerText) : ''));
      var faxNumber = trim(cfg.faxNumber) || (auto ? firstRe(FAX_RE, footerText) : '');
      if (faxNumber && isDummyDigits(faxNumber)) faxNumber = '';
      var telephone = trim(cfg.telephone) || (auto ? firstRe(TEL_RE, footerText) : '');
      if (telephone && isDummyDigits(telephone)) telephone = '';
      var streetAddress = trim(cfg.streetAddress) || (auto ? firstRe(STREET_RE, footerText) : '');
      var repName = trim(cfg.repName) || (auto ? extractRepName(footerText) : '');
      if (repName === '대표자명' || /^(대표원장|대표자|원장|대표이사|대표)$/.test(repName)) repName = '';

      var mapUrl = trim(cfg.placeUrl);
      var snsUrls = (cfg.snsUrls && cfg.snsUrls.length) ? cfg.snsUrls.slice() : [];
      var sameAsSeed = (cfg.sameAs && cfg.sameAs.length) ? cfg.sameAs.slice() : [];
      if (auto) {
        var anchors = document.querySelectorAll('a[href]');
        for (var j = 0; j < anchors.length; j++) {
          var href = anchors[j].getAttribute('href') || '';
          var kind = classifyLink(href);
          if (kind === 'map' && !mapUrl) { mapUrl = href; }
          else if (kind === 'sns') { snsUrls.push(href); }
        }
      }
      var sameAs = dedupe(sameAsSeed.concat(mapUrl ? [mapUrl] : []).concat(snsUrls));

      var titleEl = document.querySelector('title');
      var descEl = document.querySelector('meta[name="description"]');
      var ogImageEl = document.querySelector('meta[property="og:image"]');
      var ogSiteEl = document.querySelector('meta[property="og:site_name"]');
      var origin = (window.location && window.location.origin) || '';
      if (!origin && window.location) {
        origin = (location.protocol || 'https:') + '//' + (location.host || '');
      }
      var pageUrl = origin + (location.pathname || '/') + (location.search || '');
      var siteTitle = trim(cfg.name) || (ogSiteEl && ogSiteEl.getAttribute('content')) || (titleEl && titleEl.textContent) || document.title || origin;
      var description = (descEl && descEl.getAttribute('content')) || '';
      var ogImage = trim(cfg.logo) || (ogImageEl && ogImageEl.getAttribute('content')) || '';
      var path = location.pathname || '/';
      var home = path === '/' || path === '' || /\/index\.(html?|php|asp|aspx)$/i.test(path);
      var orgTypes = (cfg.orgType && cfg.orgType.length) ? cfg.orgType : DEFAULTS.orgType;
      var pageType = trim(cfg.pageType) || (home && isMedical(orgTypes) ? 'MedicalWebPage' : 'WebPage');

      injectLlmsHelpLink();

      var orgId = origin + '/#organization';
      var websiteId = origin + '/#website';
      var personId = origin + '/#person';
      var pageId = pageUrl + '#webpage';
      var crumbId = pageUrl + '#breadcrumb';

      var orgNode = { '@type': orgTypes, '@id': orgId };
      setIf(orgNode, 'name', siteTitle);
      setIf(orgNode, 'url', origin);
      setIf(orgNode, 'logo', ogImage);
      setIf(orgNode, 'telephone', telephone);
      setIf(orgNode, 'taxID', taxId);
      setIf(orgNode, 'faxNumber', faxNumber);

      if (streetAddress) {
        var addr = { '@type': 'PostalAddress' };
        setIf(addr, 'streetAddress', streetAddress);
        setIf(addr, 'addressLocality', cfg.addressLocality);
        setIf(addr, 'addressRegion', cfg.addressRegion);
        setIf(addr, 'postalCode', cfg.postalCode);
        setIf(addr, 'addressCountry', cfg.addressCountry || 'KR');
        orgNode.address = addr;
      }
      if (trim(cfg.latitude) && trim(cfg.longitude)) {
        orgNode.geo = { '@type': 'GeoCoordinates', latitude: trim(cfg.latitude), longitude: trim(cfg.longitude) };
      }
      if (sameAs.length) orgNode.sameAs = sameAs;

      var catalogRaw = (cfg.serviceCatalog && cfg.serviceCatalog.length) ? cfg.serviceCatalog : cfg.services;
      var services = normalizeServices(catalogRaw, orgTypes);
      if (!services.length && auto) {
        var navSel = ['header nav a', 'header .gnb a', '#gnb a', '.gnb a', 'nav[class*="gnb"] a', '.header nav a'];
        var navRaw = [];
        var navStops = { '홈': 1, '메인': 1, 'home': 1, '소개': 1, 'about': 1, 'contact': 1, '문의': 1, '예약': 1, '로그인': 1, '회원가입': 1, '사이트맵': 1, '이용약관': 1, '더보기': 1, '바로가기': 1, '오시는길': 1, '인사말': 1, '공지사항': 1, '게시판': 1 };
        for (var ni = 0; ni < navSel.length; ni++) {
          var navNodes;
          try { navNodes = document.querySelectorAll(navSel[ni]); } catch (eNav) { continue; }
          for (var nj = 0; nj < navNodes.length; nj++) {
            var nName = trim(textOf(navNodes[nj]).replace(/\s+/g, ' '));
            if (!nName || navStops[nName]) continue;
            var nHref = absUrl(navNodes[nj].getAttribute('href') || '', origin);
            navRaw.push(nHref ? { name: nName, url: nHref } : nName);
          }
        }
        services = normalizeServices(navRaw, orgTypes);
      }
      if (services.length) {
        orgNode.availableService = services;
        var offers = [];
        for (var si = 0; si < services.length; si++) {
          offers.push({
            '@type': 'Offer',
            itemOffered: services[si]
          });
        }
        orgNode.hasOfferCatalog = {
          '@type': 'OfferCatalog',
          name: CATALOG_NAME,
          itemListElement: offers
        };
      }

      mergeExistingOrganization(orgNode);

      var websiteNode = { '@type': 'WebSite', '@id': websiteId };
      setIf(websiteNode, 'name', siteTitle);
      setIf(websiteNode, 'url', origin);
      websiteNode.publisher = { '@id': orgId };

      var crumbItems = parseBreadcrumbDom(origin, pageUrl, document.title || siteTitle);
      if (!crumbItems.length) {
        crumbItems = fallbackCrumbs(home, origin, pageUrl, siteTitle, document.title || siteTitle);
      }
      var breadcrumbNode = {
        '@type': 'BreadcrumbList',
        '@id': crumbId,
        itemListElement: crumbItems
      };

      var webpageNode = { '@type': pageType, '@id': pageId };
      setIf(webpageNode, 'name', document.title || siteTitle);
      setIf(webpageNode, 'url', pageUrl);
      setIf(webpageNode, 'description', description);
      webpageNode.isPartOf = { '@id': websiteId };
      webpageNode.about = { '@id': orgId };
      webpageNode.breadcrumb = { '@id': crumbId };

      var graph = [orgNode, websiteNode, webpageNode, breadcrumbNode];
      if (repName) {
        var personNode = { '@type': 'Person', '@id': personId };
        setIf(personNode, 'name', repName);
        setIf(personNode, 'jobTitle', cfg.repTitle);
        personNode.worksFor = { '@id': orgId };
        graph.push(personNode);
        if (!orgNode.founder) orgNode.founder = { '@id': personId };
        if (!orgNode.employee) orgNode.employee = { '@id': personId };
      }

      var script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'redue-universal-schema';
      script.text = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
      (document.head || document.documentElement).appendChild(script);
    }

    if (document.readyState === 'loading') {
      if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', run);
      } else {
        run();
      }
    } else {
      run();
    }
  } catch (e) { /* never break the host page */ }
})();
