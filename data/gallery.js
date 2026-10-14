/* ============================================================
   GALLERY — real Mad Monkey hostel photos (127 verified), served through the main site's
   own image optimiser so guests get ~750px files, not the multi-MB originals.
   Each path was loaded and size-checked in Oct 2026. If one 404s the UI just hides it.
   Before launch: mirror these to your own CDN (see README).
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};
  var SRC = 'https://madmonkey-wp.sgp1.cdn.digitaloceanspaces.com/';
  var G = {
    'koh-rong': 'wp-content/uploads/2022/11/kr4.jpg,wp-content/uploads/2022/11/kr2.jpg,wp-content/uploads/2022/11/kr3-1.jpg,wp-content/uploads/2022/11/koh_rong.png',
    'koh-sdach': 'wp-content/uploads/2024/11/ksd1.jpg,wp-content/uploads/2024/11/ksd.jpg,wp-content/uploads/2024/11/ksd3.jpg,wp-content/uploads/2024/11/ksd2.jpg,wp-content/uploads/2024/11/ksd4.jpg,wp-content/uploads/2024/11/koh_sdach.png',
    'panglao': 'wp-content/uploads/2022/11/plo-TB.jpg,wp-content/uploads/2022/11/plo-1.png,wp-content/uploads/2022/11/plo3.jpg,wp-content/uploads/2022/11/plo2.png,wp-content/uploads/2022/11/plo4.jpg,wp-content/uploads/2022/11/panglao.png',
    'hanoi': 'destinations/14/1790054018145-1.png,wp-content/uploads/2022/11/hanoi3.jpg,wp-content/uploads/2022/11/hanoi-1.jpg,destinations/14/1790053579384-3.jpeg,destinations/14/1790053767906-1.png,destinations/14/1790053579378-1.png,destinations/14/1790053579384-5.jpeg',
    'pai': 'destinations/16/1790742033491-1.png,wp-content/uploads/2023/02/MMPAI.jpg,wp-content/uploads/2023/02/pai2.jpg,wp-content/uploads/2023/02/pai3.jpg,wp-content/uploads/2023/02/pai1.jpg,wp-content/uploads/2023/02/pai-2.png',
    'manila': 'destinations/22/1790741775730-1.png,wp-content/uploads/2023/09/mnl-1.jpg,wp-content/uploads/2023/09/mnl3.png,wp-content/uploads/2023/09/mnl-3.jpg,wp-content/uploads/2023/09/mnl-2.jpg,wp-content/uploads/2023/09/mnl4.jpg',
    'kuta-lombok': 'wp-content/uploads/2022/05/Mad-Monkey-Kuta-Lombok.jpg,wp-content/uploads/2021/12/kl3.png,wp-content/uploads/2021/12/kl4.jpg,wp-content/uploads/2021/12/5-Mad-Monkey-Kuta-Lombok.jpg,wp-content/uploads/2021/12/kl.png,wp-content/uploads/2021/12/kuta_lombok.png',
    'phuket': 'wp-content/uploads/2023/02/Untitled-design.jpg,destinations/21/1790742930269-1.png,wp-content/uploads/2023/02/pkt3.jpg,wp-content/uploads/2023/02/pkt2.jpg,wp-content/uploads/2023/02/pkt4.jpg,wp-content/uploads/2023/02/pkt5.jpg',
    'phnom-penh': 'wp-content/uploads/2021/12/SECOND-PHOTO-.jpg,wp-content/uploads/2021/12/image-1.png,wp-content/uploads/2021/12/pp3.jpg,wp-content/uploads/2021/12/Untitled-design.jpg,wp-content/uploads/2021/12/Tours_travel-4.jpg,wp-content/uploads/2021/12/phnom_penh.png,wp-content/uploads/2026/01/PP-Standard12-Bed-Dorm-(FTR).jpg',
    'dumaguete': 'wp-content/uploads/2025/10/mmdgt_1st_picture.jpeg,wp-content/uploads/2022/11/dgt.png,wp-content/uploads/2022/11/dgt-1.png,wp-content/uploads/2022/11/dgt2.png,wp-content/uploads/2022/11/dumaguete.png',
    'bangkok': 'destinations/8/1790741900995-1.jpeg,wp-content/uploads/2021/12/bkk.jpg,wp-content/uploads/2021/12/f5bk2hnuhgbnfclkemox.jpg,wp-content/uploads/2021/12/bkk2.jpg,wp-content/uploads/2021/12/2-Mad-Monkey-Bangkok.jpg,wp-content/uploads/2021/12/4-Mad-Monkey-Bangkok.jpg',
    'hoi-an': 'destinations/11/1788858261268-1.jpg,destinations/11/1788858304845-1.jpg,destinations/11/1788858294413-1.jpg,destinations/11/1790130218421-3.jpeg,destinations/11/1790130218422-5.png,destinations/11/1790130218421-4.jpeg',
    'nacpan-beach': 'wp-content/uploads/2021/12/nacpan.png',
    'kampot': '2025/1_3_Morning_on_Vacation.jpg,2025/1_4_Sunset.jpg,2025/1_6_Photo.jpg,2025/1_5_Photo.jpg,2025/1_8_Photo.jpg,2025/madmonkey_kampot.png',
    'chiang-mai': 'wp-content/uploads/2023/02/cgm3.jpg,wp-content/uploads/2023/02/CGM.jpg,wp-content/uploads/2023/02/main-cgm.jpg,wp-content/uploads/2023/02/4-Mad-Monkey-Chiang-Mai.jpg,wp-content/uploads/2023/02/chiang_mai.png,wp-content/uploads/2023/02/cgm2.jpg',
    'uluwatu': 'wp-content/uploads/2025/03/Hostel-6.png,wp-content/uploads/2025/03/Hostel-3-1.png,wp-content/uploads/2025/03/Hostel.jpg,wp-content/uploads/2025/03/Hostel-4-1.png,wp-content/uploads/2025/03/Hostel-5-1.png,wp-content/uploads/2023/02/uluwatu.png',
    'nusa-lembongan': 'wp-content/uploads/2024/04/nl2-1.png,wp-content/uploads/2024/04/Exterior-View.png,wp-content/uploads/2024/04/Main-Photo-1.png,wp-content/uploads/2024/04/nl4.png,wp-content/uploads/2024/04/nl3.png,wp-content/uploads/2024/04/panoramic-view.png',
    'siem-reap': 'wp-content/uploads/2021/12/sr1.jpg,wp-content/uploads/2021/12/sr4.jpg,wp-content/uploads/2021/12/sr3.jpg,wp-content/uploads/2021/12/3-Mad-Monkey-Siem-Reap.jpg,wp-content/uploads/2021/12/sr2.jpg,wp-content/uploads/2021/12/siem_reap.png',
    'siquijor': 'wp-content/uploads/2023/02/sqr-m-ain.jpg,wp-content/uploads/2023/02/sqr.jpg,wp-content/uploads/2023/02/SQR-Hostel-3-1-scaled.jpeg,wp-content/uploads/2023/02/sqr1.jpg,wp-content/uploads/2023/02/sqr2.jpg,wp-content/uploads/2023/02/siquijor.png',
    'vang-vieng': 'destinations/20/1790739327829-1.png,wp-content/uploads/2023/02/vv.jpg,wp-content/uploads/2023/02/MMVV.jpg,wp-content/uploads/2023/02/vv1.jpg,wp-content/uploads/2023/02/vv3.jpg,wp-content/uploads/2023/02/vv4.jpg,wp-content/uploads/2023/02/vang_vieng.png',
    'gili-trawangan': 'wp-content/uploads/2021/12/Untitled-design-1-1.jpg,wp-content/uploads/2021/12/3-Mad-Monkey-Gili-T.jpg,wp-content/uploads/2021/12/glt-1.png,wp-content/uploads/2021/12/glt3.png,wp-content/uploads/2021/12/glt-2.png',
    'siargao': 'wp-content/uploads/2021/12/siargao.png',
    'luang-prabang': 'wp-content/uploads/2021/12/mmlpb.jpg,wp-content/uploads/2026/01/luang_prabang_banner4.jpg,wp-content/uploads/2026/01/luang_prabang_banner3.jpeg,wp-content/uploads/2021/12/lp4.jpg,wp-content/uploads/2022/04/1-Mad-Monkey-Luang-Prabang.jpg,wp-content/uploads/2021/12/luang_prabang.png'
  };
  MM.gallery = function (id) {
    return (G[id] ? G[id].split(',') : []).map(function (p) { return 'https://madmonkeyhostels.com/_next/image?url=' + encodeURIComponent(SRC + p) + '&w=750&q=70'; });
  };
  if (typeof module !== 'undefined') module.exports = { G: G };
})(typeof window !== 'undefined' ? window : globalThis);
