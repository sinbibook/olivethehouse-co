(function (global) {
  'use strict';

  function setAllText(selector, value) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.textContent = value;
    });
  }

  function DirectionsMapper() {
    BaseDataMapper.call(this);
  }
  DirectionsMapper.prototype = Object.create(BaseDataMapper.prototype);
  DirectionsMapper.prototype.constructor = DirectionsMapper;

  // 섹션 배정 — pages.directions.sections[0]
  //   hero.images[0]     → .sub_visual_wide 배경
  //   hero.title         → .sub_title_box h3 (본문 제목)
  //   notice             → .map_info dl (교통 안내)
  //
  // 주소와 좌표는 pages 가 아니라 property 에서 온다.
  //   property.address                 → .map_info strong
  //   property.latitude / longitude    → 지도
  //
  // ⚠️ directions.hero 에는 description 이 없다 (reservation 과 같다).
  //    index / main / nearbyAttractions / layoutMap 의 hero 에는 있다.
  DirectionsMapper.prototype.getSection = function () {
    var page = this.getPages().directions;
    return (page && page.sections && page.sections[0]) || {};
  };

  DirectionsMapper.prototype.mapPage = function () {
    this.mapHero();
    this.mapLead();
    this.mapAddress();
    this.mapNotice();
    this.mapKakaoMap();
  };

  // MAPPER: hero.images → .sub_visual_wide (390px 고정 배경 + 흰 글자)
  //
  // 히어로 문구는 둘 다 **고정**이다 — strong `LOCATION`, p `{숙소명} 오시는 길`.
  // 사진 위 38px 대제목 자리라 업주 문구가 들어가면 배경을 가린다
  // (layout-map / nearby-attractions 와 같은 판단).
  // hero.title 은 흰 지면 위 .sub_title_box 가 받는다.
  //
  // 원본은 히어로가 `LOCATION`, 본문 제목이 `DIRECTIONS` 로 서로 다르다.
  DirectionsMapper.prototype.mapHero = function () {
    var self = this;
    var hero = this.getSection().hero || {};
    var name = this.getPropertyName();

    setAllText('[data-directions-hero-description]', name ? name + ' 오시는 길' : '오시는 길');

    var url =
      this.getFirstSelectedImage(hero.images || []) ||
      (this.pickPropertyImage(['exterior', 'thumbnail']) || {}).url ||
      '';
    document.querySelectorAll('[data-directions-hero]').forEach(function (el) {
      self.setBackground(el, url, '오시는 길 이미지');
    });
  };

  // MAPPER: hero.title → .sub_title_box h3 / 설명은 원본 문구 + 숙소명
  //
  // 흰 지면 위 제목이라 업주 문구가 길어져도 레이아웃이 버틴다.
  // directions.hero 에는 description 이 없어 설명 줄은 고정이다.
  DirectionsMapper.prototype.mapLead = function () {
    var hero = this.getSection().hero || {};
    var name = this.getPropertyName();

    setAllText('[data-directions-title]', this.firstText(hero.title, 'DIRECTIONS'));
    setAllText(
      '[data-directions-lead]',
      (name ? name + '에 ' : '') + '찾아 오시는 길을 안내해 드립니다.'
    );
  };

  // MAPPER: property.address → .map_info strong
  // 값이 없으면 줄째 숨긴다 ("주소 : " 만 남는 빈 줄 방지)
  DirectionsMapper.prototype.mapAddress = function () {
    var prop = this.getProperty();
    var address = this.firstText(prop.address, (prop.businessInfo || {}).businessAddress);

    document.querySelectorAll('[data-directions-address]').forEach(function (el) {
      el.textContent = address ? '주소 : ' + address : '';
      el.style.display = address ? '' : 'none';
    });
  };

  // MAPPER: notice → .map_info dl (dt 제목 + dd 본문) × N
  //
  // 원본은 `승용차 이용 시` dt/dd 다음에 `대중교통 이용 시` dt/dd 가 이어진다
  // (처음 참고한 사이트는 대중교통 쪽이 주석 처리돼 있었지만, 돌궁펜션처럼 살아 있는 곳도 있다).
  // CSS 도 `.map_info dl dd + dt` 로 여러 항목을 전제한다.
  //
  // 우리 notice 는 { title, description } 하나라 G/E2 의 다중 블록 규약을 따른다.
  //
  //   description = "※ 네비게이션에 …\n\n지번주소 : …\n도로명주소 : …
  //                  \n\n대중교통 이용 시\n가평역 정류장 …"
  //
  // - notice.title 이 첫 블록 제목이다 (첫 블록 본문에는 제목 줄이 없다)
  // - 빈 줄 뒤 덩어리의 첫 줄이 제목처럼 생겼고(isNoticeTitle) 본문 줄이 이어지면 새 블록이다
  // - 그 밖의 빈 줄은 원본 본문 안의 줄바꿈(<br><br>)이라 같은 블록에 붙인다
  //   (돌궁펜션 승용차 안내가 "※ 안내\n\n지번주소 : …" 다)
  //
  // 본문이 아예 없으면 dl 째 숨긴다 — 제목만 남으면 빈 항목이 된다.
  DirectionsMapper.prototype.mapNotice = function () {
    var blocks = this.parseNoticeBlocks();
    var hasBody = blocks.some(function (b) {
      return b.body;
    });

    var self = this;
    document.querySelectorAll('[data-directions-notice]').forEach(function (dl) {
      dl.innerHTML = '';
      if (!hasBody) {
        dl.style.display = 'none';
        return;
      }
      dl.style.display = '';

      blocks.forEach(function (block) {
        var dt = document.createElement('dt');
        dt.textContent = block.title;
        var dd = document.createElement('dd');
        dd.innerHTML = self.nl2br(block.body);
        dl.appendChild(dt);
        dl.appendChild(dd);
      });
    });
  };

  DirectionsMapper.prototype.DEFAULT_NOTICE_TITLE = '승용차 이용 시';

  // "대중교통 이용 시" 같은 짧은 한 줄. ※ 안내문이나 "지번주소 : …" 는 제목이 아니다.
  DirectionsMapper.prototype.isNoticeTitle = function (line) {
    var s = String(line || '').trim();
    if (!s || s.length > 20) return false;
    return !/^※/.test(s) && s.indexOf(':') === -1;
  };

  DirectionsMapper.prototype.parseNoticeBlocks = function () {
    var self = this;
    var notice = this.getSection().notice || {};
    var chunks = this.cleanText(notice.description)
      .split(/\n\s*\n/)
      .map(function (c) {
        return c.trim();
      })
      .filter(Boolean);

    var blocks = [];
    chunks.forEach(function (chunk) {
      var lines = chunk.split('\n');
      if (blocks.length && lines.length > 1 && self.isNoticeTitle(lines[0])) {
        blocks.push({ title: lines.shift().trim(), body: lines.join('\n').trim() });
        return;
      }
      if (!blocks.length) {
        blocks.push({ title: self.firstText(notice.title, self.DEFAULT_NOTICE_TITLE), body: chunk });
        return;
      }
      var last = blocks[blocks.length - 1];
      last.body = last.body ? last.body + '\n\n' + chunk : chunk;
    });
    return blocks;
  };

  // ── 지도 ────────────────────────────────────────────────
  // 원본은 daum roughmap 퍼가기 스크립트를 썼다. 업체 고유 key 가 필요해
  // 재현할 수 없으므로 Kakao Maps SDK(js/kakao-maps-sdk.js)로 대체했다.
  //
  // preview 는 데이터가 바뀔 때마다 매핑을 다시 돌린다. 그때마다 new Map() 을
  // 만들면 인스턴스가 쌓이므로, 이미 있으면 중심만 옮긴다.
  DirectionsMapper.prototype.mapKakaoMap = function () {
    var self = this;
    var container = document.getElementById('kakao-map');
    if (!container) return;

    var prop = this.getProperty();
    var lat = Number(prop.latitude);
    var lng = Number(prop.longitude);

    // 좌표가 없어도 영역은 유지한다. .map_inner 는 padding-bottom 비율 상자라
    // 안을 비우면 테두리만 남은 빈 띠가 되어 페이지가 무너진 것처럼 보인다.
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      ImageHelpers.applyBackgroundPlaceholder(container, '지도');
      return;
    }
    container.classList.remove('empty-image-placeholder');
    container.style.backgroundImage = '';

    function createMap() {
      try {
        var position = new kakao.maps.LatLng(lat, lng);

        if (self._kakaoMap) {
          self._kakaoMap.setCenter(position);
          self._kakaoMap.relayout();
          if (self._kakaoMarker) self._kakaoMarker.setPosition(position);
          return;
        }

        self._kakaoMap = new kakao.maps.Map(container, { center: position, level: 4 });
        self._kakaoMarker = new kakao.maps.Marker({ position: position });
        self._kakaoMarker.setMap(self._kakaoMap);

        // 지도가 숨겨진 상태로 생성되면 크기를 0 으로 잡는다. 노출 후 다시 계산한다.
        window.addEventListener('resize', function () {
          if (!self._kakaoMap) return;
          self._kakaoMap.relayout();
          self._kakaoMap.setCenter(position);
        });
      } catch (e) {
        console.error('[directions] kakao map init failed:', e);
      }
    }

    if (window.kakao && window.kakao.maps && window.kakao.maps.load) {
      window.kakao.maps.load(createMap);
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    // 초기화 주체는 preview-handler 다. 중복 실행을 막는다.
    if (window.previewHandler) return;
    new DirectionsMapper().initialize();
  });

  global.DirectionsMapper = DirectionsMapper;
})(window);
