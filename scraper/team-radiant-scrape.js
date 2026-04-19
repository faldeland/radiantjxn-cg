import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVE_URL = 'https://radiantjxn.com/serve';
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'data', 'team-radiant.json');
const SOCIAL_IMAGES_PATH = path.join(__dirname, '..', 'public', 'data', 'social-images.json');

/** Master Team Radiant application (Church Center); ministry area is chosen on the form */
export const TEAM_RADIANT_SIGNUP =
  'https://radiantjxn.churchcenter.com/people/forms/586040';

/** Local art under public/images/serve (served as /images/serve/…) */
const SERVE_IMG = '/images/serve';

const IMAGE_BY_ID = {
  'prayer-team': `${SERVE_IMG}/prayer-2.png`,
  'prayer-intercessory': `${SERVE_IMG}/prayer-1.png`,
  'worship-vocals': `${SERVE_IMG}/vocals.png`,
  'worship-band': `${SERVE_IMG}/instrumentals-1.png`,
  'fi-coffee': `${SERVE_IMG}/coffee-1.png`,
  'fi-greeters': `${SERVE_IMG}/greeters-4.png`,
  'fi-information': `${SERVE_IMG}/greeters-3.png`,
  'fi-ushers': `${SERVE_IMG}/ushers-1.png`,
  'fi-parking': `${SERVE_IMG}/parking-1.png`,
  'fi-medical': `${SERVE_IMG}/prayer-1.png`,
  'fi-merchandise': `${SERVE_IMG}/greeters-1.png`,
  'ng-infants': `${SERVE_IMG}/kids-1.png`,
  'ng-early-childhood': `${SERVE_IMG}/kids-2.png`,
  'ng-elementary': `${SERVE_IMG}/kids-6.png`,
  'ng-check-in': `${SERVE_IMG}/kids-checkin-1.png`,
  'ng-radiant-friends': `${SERVE_IMG}/kids-5.png`,
  'stu-middle-school': `${SERVE_IMG}/kids-4.png`,
  'stu-jr-high': `${SERVE_IMG}/kids-4.png`,
  'stu-sr-high': `${SERVE_IMG}/kids-6.png`,
  'caw-service-director': `${SERVE_IMG}/production-3.png`,
  'caw-producer': `${SERVE_IMG}/producer-1.png`,
  'caw-graphic-tech': `${SERVE_IMG}/graphics-tech-1.png`,
  'caw-audio-tech': `${SERVE_IMG}/audio-tech-1.png`,
  'caw-camera-operator': `${SERVE_IMG}/camera-operator-1.png`,
  'disc-leader': `${SERVE_IMG}/community-group-leader-1.png`,
  'cg-grow': `${SERVE_IMG}/greeters-3.png`,
  'cg-go': `${SERVE_IMG}/greeters-4.png`,
};

const IMAGE_BY_TAG = {
  Welcome: `${SERVE_IMG}/greeters-4.png`,
  Music: `${SERVE_IMG}/worship-1.png`,
  Prayer: `${SERVE_IMG}/prayer-2.png`,
  'Next Generation': `${SERVE_IMG}/kids-6.png`,
  Tech: `${SERVE_IMG}/production-3.png`,
  Students: `${SERVE_IMG}/kids-6.png`,
  Serve: `${SERVE_IMG}/ushers-1.png`,
  Community: `${SERVE_IMG}/greeters-2.png`,
};

const DEFAULT_OPPORTUNITY_IMAGE = IMAGE_BY_TAG.Serve;

/**
 * Curated roles aligned with Team Radiant ministry areas (tiles → same Church Center form).
 * groupId: prayer | worship | first-impressions | next-generation | radiant-students | community-groups | creative-arts-worship
 */
const CURATED_OPPORTUNITIES = [
  {
    groupId: 'prayer',
    id: 'prayer-team',
    title: 'Prayer Partners',
    tag: 'Prayer',
    description:
      'Stand in the gap through intercession for our church family, our city, and the nations—in the prayer room on Sundays, in corporate prayer, or behind the scenes.',
  },
  {
    groupId: 'prayer',
    id: 'prayer-intercessory',
    title: 'Intercessory Prayer',
    tag: 'Prayer',
    description:
      'Pray for those in need during every service from the Ministry Center. This team covers our worship gatherings with intercession, standing in the gap so that every person who walks through our doors encounters the presence of God.',
  },
  {
    groupId: 'creative-arts-worship',
    id: 'worship-vocals',
    title: 'Vocal',
    tag: 'Music',
    description:
      'This team expresses their worship through singing and physical gestures to invite others to enter into and encounter the presence of the Lord.',
  },
  {
    groupId: 'creative-arts-worship',
    id: 'worship-band',
    title: 'Instruments',
    tag: 'Music',
    description:
      'This team expresses their worship through instruments commonly used in our culture such as: Drums, Percussion, Guitars, Piano, and Orchestral Strings to invite others to enter into and encounter the presence of the Lord.',
  },
  {
    groupId: 'first-impressions',
    id: 'fi-coffee',
    title: 'Coffee',
    tag: 'Welcome',
    description:
      'The coffee team exists to enhance fellowship, set an approachable atmosphere, and promote community through quality coffee and service.',
  },
  {
    groupId: 'first-impressions',
    id: 'fi-greeters',
    title: 'Greeter',
    tag: 'Welcome',
    description:
      'This friendly team loves people and makes them feel at home here at Radiant. They welcome guests with a smile, encouragement, and a comforting atmosphere so that hearts are open to the Gospel message.',
  },
  {
    groupId: 'first-impressions',
    id: 'fi-information',
    title: 'Information Center',
    tag: 'Welcome',
    description:
      'This team connects guests to the Church community, providing resources and information on all of our current events, ministry opportunities, and services at Radiant.',
  },
  {
    groupId: 'first-impressions',
    id: 'fi-ushers',
    title: 'Usher',
    tag: 'Welcome',
    description:
      'This team prepares a positive worship experience by welcoming and assisting people to a seat, facilitating the offering and communion, and maintaining a distraction-free environment.',
  },
  {
    groupId: 'first-impressions',
    id: 'fi-parking',
    title: 'Parking',
    tag: 'Welcome',
    description:
      'This team is the first impression of Radiant and operates to create an orderly atmosphere and welcoming environment. If you want to be the very first to welcome our guests to Radiant, this is the team for you.',
  },
  {
    groupId: 'first-impressions',
    id: 'fi-medical',
    title: 'Medical Responder',
    tag: 'Welcome',
    description:
      'These individuals work with our Safety Team to supply medical care in case of emergency. Previous medical training and experience are required.',
  },
  {
    groupId: 'first-impressions',
    id: 'fi-merchandise',
    title: 'Merchandise Team',
    tag: 'Welcome',
    description:
      'This team promotes our church and its mission by offering quality merchandise that sparks conversations and shares the message of Christ with our community. Every purchase helps spread the word and create opportunities for faith encounters.',
  },
  {
    groupId: 'next-generation',
    id: 'ng-infants',
    title: 'Infants',
    tag: 'Next Generation',
    description:
      'For ages 6 weeks to 23 months. Infants receive individual attention from trained volunteers. We attend to your child’s physical and spiritual needs by holding, talking to, and praying for each child.',
  },
  {
    groupId: 'next-generation',
    id: 'ng-early-childhood',
    title: 'Early Childhood',
    tag: 'Next Generation',
    description:
      'For ages 2 years to kindergarten. Children in this age group enjoy experiential play, a lesson that teaches age-appropriate Biblical truths, and a time of interactive praise and worship. The monthly memory verse engages kids to hide God’s Word in their hearts. After a simple snack and story, children depart with ideas for continued learning at home.',
  },
  {
    groupId: 'next-generation',
    id: 'ng-elementary',
    title: 'Elementary',
    tag: 'Next Generation',
    description:
      'For 1st–4th graders. Children experience a purposeful and fun worship service. They strengthen friendships with leaders and other kids through play. Together, we connect with God in worship, praising Him through music, dance, giving, and prayer. In every service, kids receive Biblical truth with life application, putting God’s Word to work in their lives today, while also laying a firm foundation for the future.',
  },
  {
    groupId: 'next-generation',
    id: 'ng-check-in',
    title: 'Check-In',
    tag: 'Next Generation',
    description:
      'This team welcomes all families as they arrive and is often the first contact for first-time guests. This team utilizes a computer system to print name tags for new children and walks families through self-check-in stations to print their own tags. Security tags are an essential component to child safety in Radiant Kids.',
  },
  {
    groupId: 'next-generation',
    id: 'ng-radiant-friends',
    title: 'Radiant Friends',
    tag: 'Next Generation',
    description:
      'This team works closely with kids who need a friend by their side to enjoy Sunday classes. Whether engaging in their age-appropriate class or spending time in the friends room, this team understands that every child is uniquely created by God and has a place in His Kingdom. For children with special needs. Spring Arbor Campus only.',
  },
  {
    groupId: 'radiant-students',
    id: 'stu-middle-school',
    title: 'Middle School',
    tag: 'Students',
    description:
      'Radiant Students exists to help middle schoolers experience three things: wonder for who God is, discovery of who He created them to be, and passion for loving others. 5th–7th graders worship in the main sanctuary each Sunday before joining their classroom for a powerful, age-appropriate message, prayer, and discussion with real-life application—designed to help students take ownership of their faith.',
  },
  {
    groupId: 'radiant-students',
    id: 'stu-jr-high',
    title: 'Jr High',
    tag: 'Students',
    description:
      'For 5th–7th grade (Sunday mornings). Radiant Students worship together in the main sanctuary before being dismissed to their class for an age-appropriate message, prayer, and group discussions with real-life applications.',
  },
  {
    groupId: 'radiant-students',
    id: 'stu-sr-high',
    title: 'Sr High',
    tag: 'Students',
    description:
      'For 7th–12th grade (Sunday nights). This group meets every Sunday from 6:00 PM to 8:15 PM. There will be a customized service with time to hang out, play games, and make new friends. We will then move into a time of intentional worship and a message with small group discussions targeted at strengthening our faith.',
  },
  {
    groupId: 'community-groups',
    id: 'cg-gather',
    title: 'Gather Group Leader',
    tag: 'Community',
    description:
      'Lead a Gather Group focused on welcoming new faces into community. Help people take their first steps toward belonging at Radiant by creating an open, hospitable environment where guests become friends and friends become family.',
  },
  {
    groupId: 'community-groups',
    id: 'cg-grow',
    title: 'Grow Group Leader',
    tag: 'Community',
    description:
      'Facilitate a Grow Group rooted in Scripture and sermon application. Guide members deeper in their faith through intentional discussion, prayer, and accountability—helping one another grow into the people God has called them to be.',
  },
  {
    groupId: 'community-groups',
    id: 'cg-go',
    title: 'Go Group Leader',
    tag: 'Community',
    description:
      'Lead a Go Group that turns faith into action. Mobilize your group to serve the local community, live out the Great Commission, and make a tangible difference in Jackson and beyond. Training and ongoing support are provided.',
  },
  {
    groupId: 'discipleship',
    id: 'disc-leader',
    title: 'Discipleship Group Leader',
    tag: 'Discipleship',
    description:
      'Walk alongside others in intentional one-on-one or small group discipleship. Help believers at Radiant grow in their knowledge of Scripture, deepen their prayer life, and develop the habits and character that mark a devoted follower of Jesus. Training and support are provided.',
  },
  {
    groupId: 'creative-arts-worship',
    id: 'caw-service-director',
    title: 'Service Director',
    tag: 'Tech',
    description:
      'Directs camera operators, graphic techs, and technical directors for both livestream and IMAG in-house. Able to remain calm under pressure and demonstrates excellent verbal communication. Has a thorough understanding of the order of each service. Some experience is preferred but not required.',
  },
  {
    groupId: 'creative-arts-worship',
    id: 'caw-producer',
    title: 'Producer',
    tag: 'Tech',
    description:
      'Operates the broadcast panel to switch live video for both livestream and IMAG in-house. Able to retain focus and follow instructions from the video director. Must be technically minded. No experience is required.',
  },
  {
    groupId: 'creative-arts-worship',
    id: 'caw-graphic-tech',
    title: 'Graphic Technician',
    tag: 'Tech',
    description:
      'Controls ProPresenter for livestream and IMAG in-house. Able to retain focus and has excellent hand-eye coordination. Must work well on a team. No experience is required.',
  },
  {
    groupId: 'creative-arts-worship',
    id: 'caw-audio-tech',
    title: 'Audio Technician',
    tag: 'Tech',
    description:
      'Mixes worship and teaching for in-house experience and for livestream. This is a highly technical position and requires someone who has had previous audio experience.',
  },
  {
    groupId: 'creative-arts-worship',
    id: 'caw-camera-operator',
    title: 'Camera Operator',
    tag: 'Tech',
    description:
      'Responsible for capturing high-quality footage, expertly framing shots, and executing smooth camera movements to bring the director’s vision to life. They work closely with the production team, ensuring that the visuals are technically precise and creatively engaging throughout the shoot.',
  },
];

const GROUP_ORDER = [
  'prayer',
  'first-impressions',
  'next-generation',
  'radiant-students',
  'community-groups',
  'discipleship',
  'creative-arts-worship',
];

/** Full tile order (group blocks follow GROUP_ORDER; roles ordered within each block) */
const TILE_ORDER = [
  'prayer-team',
  'prayer-intercessory',
  'fi-coffee',
  'fi-greeters',
  'fi-information',
  'fi-ushers',
  'fi-parking',
  'fi-medical',
  'fi-merchandise',
  'ng-infants',
  'ng-early-childhood',
  'ng-elementary',
  'ng-check-in',
  'ng-radiant-friends',
  'stu-middle-school',
  'stu-jr-high',
  'stu-sr-high',
  'cg-gather',
  'cg-grow',
  'cg-go',
  'disc-leader',
  'worship-vocals',
  'worship-band',
  'caw-service-director',
  'caw-producer',
  'caw-graphic-tech',
  'caw-audio-tech',
  'caw-camera-operator',
];

function sortTeamRadiantOpportunities(opportunities) {
  if (!opportunities?.length) return opportunities;
  return [...opportunities].sort((a, b) => {
    const ia = TILE_ORDER.indexOf(a.id);
    const ib = TILE_ORDER.indexOf(b.id);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    const ga = GROUP_ORDER.indexOf(a.groupId);
    const gb = GROUP_ORDER.indexOf(b.groupId);
    if (ga !== gb) return (ga === -1 ? 99 : ga) - (gb === -1 ? 99 : gb);
    return (a.title || '').localeCompare(b.title || '');
  });
}

function buildCuratedOpportunities(signUpUrl) {
  return sortTeamRadiantOpportunities(
    CURATED_OPPORTUNITIES.map((o) => ({ ...o, signUpUrl })),
  );
}

/** Rotate radiant.church vs radiantjxn.com hero art across ministry tags when replacing stock */
const CHURCH_ROTATION_TAGS = ['Prayer', 'Music', 'Welcome', 'Next Generation', 'Students', 'Community', 'Tech', 'Serve'];

function isUnsplashStock(url) {
  return typeof url === 'string' && url.includes('images.unsplash.com');
}

function isLocalServeImage(url) {
  return typeof url === 'string' && url.startsWith(`${SERVE_IMG}/`);
}

function churchImageForTag(data, tag) {
  const cs = data.churchSiteImages || {};
  const urls = [cs.radiantChurch, cs.radiantJxn].filter(Boolean);
  if (urls.length === 0) return data.defaultImageUrl || null;
  const idx = CHURCH_ROTATION_TAGS.indexOf(tag);
  const i = idx >= 0 ? idx : 0;
  return urls[i % urls.length];
}

function mergeSocialFromDisk(opportunities) {
  if (!fs.existsSync(SOCIAL_IMAGES_PATH)) return opportunities;
  try {
    const data = JSON.parse(fs.readFileSync(SOCIAL_IMAGES_PATH, 'utf8'));
    const byTag = data.imageByTag || {};
    const byId = data.imageById || {};
    return opportunities.map((o) => {
      const social = byId[o.id] || byTag[o.tag];
      if (social) return { ...o, imageUrl: social };
      if (isLocalServeImage(o.imageUrl)) return o;
      const church = churchImageForTag(data, o.tag);
      if (church && isUnsplashStock(o.imageUrl)) return { ...o, imageUrl: church };
      return o;
    });
  } catch {
    return opportunities;
  }
}

function withImageUrls(opportunities) {
  const withStock = opportunities.map((o) => ({
    ...o,
    imageUrl:
      o.imageUrl ||
      IMAGE_BY_ID[o.id] ||
      IMAGE_BY_TAG[o.tag] ||
      DEFAULT_OPPORTUNITY_IMAGE,
  }));
  return mergeSocialFromDisk(withStock);
}

const FALLBACK = {
  sourceUrl: SERVE_URL,
  lastUpdated: new Date().toISOString(),
  pageTitle: 'Team Radiant',
  introParagraphs: [
    'Here at Radiant we believe that the local church is the hope of the world and how we reach and serve our community with the love and life giving message of Jesus, so that they may become full devoted followers of Him.',
    'By providing the best Sunday experience we can for those who walk through our doors, we can help them to live out their faith and be Jesus to this city. We also believe that every follower of Jesus has a part to play in serving the house of God. We know that serving the local church helps us to find community, grow in faith, and develop a servant’s heart to reach our city all while we serve those searching for Hope. From the parking lot to the pulpit, every position is eternal. So, no matter your gifting, talents or interests, we believe there is a place for you on Team Radiant!',
  ],
  signUpUrl: TEAM_RADIANT_SIGNUP,
  closingNote:
    'After you submit your application, someone from our team will follow up with you and get you connected with a serving team.',
  opportunities: withImageUrls(buildCuratedOpportunities(TEAM_RADIANT_SIGNUP)),
};

function buildTeamRadiantPayload(parsedIntro, parsedSignUp) {
  const signUpUrl = parsedSignUp || TEAM_RADIANT_SIGNUP;
  const introParagraphs =
    parsedIntro && parsedIntro.length > 0 ? parsedIntro : FALLBACK.introParagraphs;
  const opportunities = withImageUrls(buildCuratedOpportunities(signUpUrl));
  return {
    sourceUrl: SERVE_URL,
    lastUpdated: new Date().toISOString(),
    pageTitle: 'Team Radiant',
    introParagraphs,
    signUpUrl,
    closingNote: FALLBACK.closingNote,
    opportunities,
  };
}

export async function scrapeTeamRadiant(log = console.log) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    log(`Playwright unavailable (${e.message}); using embedded Team Radiant snapshot.`);
    return { ...FALLBACK, lastUpdated: new Date().toISOString() };
  }

  let context;
  try {
    context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    const page = await context.newPage();
    await page.goto(SERVE_URL, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1500);

    const parsed = await page.evaluate(() => {
      let signUpUrl = '';
      for (const a of document.querySelectorAll('a[href]')) {
        const h = a.getAttribute('href') || '';
        if (/churchcenter\.com.*forms/i.test(h) || /\/people\/forms\//i.test(h)) {
          signUpUrl = a.href;
          break;
        }
      }

      const root = document.querySelector('main, article, [role="main"], #main_page_content') || document.body;
      const allH = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'));

      let servingIdx = -1;
      for (let i = 0; i < allH.length; i++) {
        if (/serving opportunities/i.test((allH[i].textContent || '').trim())) {
          servingIdx = i;
          break;
        }
      }

      const introParagraphs = [];
      if (servingIdx >= 0) {
        const marker = allH[servingIdx];
        for (const p of root.querySelectorAll('p')) {
          if (marker.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_PRECEDING) {
            const t = (p.textContent || '').trim();
            if (t.length > 40 && !/sign up to serve/i.test(t)) introParagraphs.push(t);
          }
        }
      }

      return { signUpUrl, introParagraphs };
    });

    await context.close();
    await browser.close();
    browser = null;

    return buildTeamRadiantPayload(parsed.introParagraphs, parsed.signUpUrl);
  } catch (err) {
    log(`Team Radiant scrape error: ${err.message}`);
    if (context) await context.close().catch(() => {});
    return { ...FALLBACK, lastUpdated: new Date().toISOString() };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

export function saveTeamRadiantData(data, outputPath) {
  const dest = outputPath || OUTPUT_PATH;
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(data, null, 2));
  return dest;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  scrapeTeamRadiant().then((data) => {
    const dest = saveTeamRadiantData(data);
    console.log(`Wrote ${data.opportunities.length} opportunities to ${dest}`);
  });
}
