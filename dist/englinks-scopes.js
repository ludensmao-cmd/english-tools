/* Restore the captured Vue scope attributes for our independently rendered
   content. Component boundaries prevent generic .content/.title rules from
   escaping into nested components. The original source CSS stays unchanged. */
(() => {
  'use strict';
  const rules = [
    ['.Layout','49b94f76'],['.VPContent','1fcbc27d'],['.VPDoc','bbe6346a'],
    ['.VPDocFooter','d2882a89'],['.VPDocAside','6d33de53'],
    ['.VPDocAsideOutline','5ec074d0'],['.VPDocOutlineItem','b83511b5'],
    ['.category-hero','0770416a'],['.prompt-grid','441c0934'],
    ['.prompt-card','97d45cc3'],['.prompt-studio','884f193a'],
    ['.prompt-builder','baf11759'],['.lang-select','b48efea9'],
    ['.prompt-select','40ffc60b'],['.level-picker','b0592b75'],
    ['.copy-btn','f173524b'],['.prompt-launcher','b56f934f'],
    ['.blog-list,.blog-item','21e8d7a0'],['.post-meta','3d5914e5'],
    ['.cta-card','26199855'],['.app-icon','6d3ae1c9'],
    ['.VPNav','3d3b6169'],['.VPNavBar','b5a09ea0'],
    ['.VPNavBarTitle','8ff585d9'],['.VPNavBarMenu','207cb7fd'],
    ['.VPNavBarMenuLink','0d4d3bc8'],['.VPNavBarTranslations','d6c279e8'],
    ['.VPFlyout','af62b20f'],['.VPMenu','6faa225e'],['.VPMenuLink','7f9ccf7a'],
    ['.VPNavBarAppearance','3f38f101'],['.VPSwitchAppearance','5396ca3e'],
    ['.VPSwitch','942af061'],['.VPNavBarSocialLinks','7ba09077'],
    ['.VPSocialLinks','dbbd2c26'],['.VPSocialLink','76c897e4'],
    ['.VPNavBarHamburger','2e045c15'],['.VPNavBarExtra','c194adec'],
    ['.VPLocalNav','0136a48c'],['.VPSidebar','d29ff30c'],
    ['.VPSidebar .group','9994529b'],['.VPSidebarItem','9f71b922'],
    ['.site-footer','2b24bb81']
  ];
  const boundary = rules.map(([selector])=>selector).join(',')+',.vp-doc';
  function ownScope(component,scope) {
    const attr=`data-v-${scope}`;
    component.setAttribute(attr,'');
    function walk(parent) {
      for(const child of parent.children) {
        child.setAttribute(attr,'');
        if(!child.matches(boundary))walk(child);
      }
    }
    walk(component);
  }
  function stamp(root=document) {
    if(!root?.querySelectorAll)return;
    for(const [selector,scope] of rules) {
      if(root.nodeType===1 && root.matches(selector))ownScope(root,scope);
      root.querySelectorAll(selector).forEach(component=>ownScope(component,scope));
    }
  }
  window.englishStampScopes = stamp;
  stamp();
  const ai=document.getElementById('ai-prompt-library');
  if(ai && typeof MutationObserver!=='undefined') {
    new MutationObserver(records=>{
      const roots=new Set();
      records.forEach(record=>record.addedNodes.forEach(node=>{
        if(node.nodeType!==1)return;
        roots.add(node.closest('.prompt-studio,.prompt-card')||node);
      }));
      roots.forEach(stamp);
    }).observe(ai,{childList:true,subtree:true});
  }
})();
