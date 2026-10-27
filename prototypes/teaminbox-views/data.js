// Sample data for the TeamInbox views prototype. Mirrors the content in the V3 view designs.
window.TIB = (() => {
  const INBOXES = [
    { id: 'design', name: 'Design garage', ch: 'mail', count: 74 },
    { id: 'igarage', name: 'iGarage', ch: 'whatsapp' },
    { id: 'tech', name: 'Tech garage', ch: 'twitter' },
    { id: 'meta', name: 'Meta', ch: 'facebook' },
  ];
  const TAGS = {
    official: { name: 'Official', color: '#3fb36a' },
    important: { name: 'Important', color: '#a46ad8' },
    progress: { name: 'In progress', color: '#f08c2e' },
    almost: { name: 'Almost completed', color: '#17a99b' },
    review: { name: 'Needs review', color: '#e0504a' },
  };
  const P1 = 'Shared team inboxes can be a very simple yet effective way to make it easier for your team to collaborate. If managed correctly, shared inboxes can be used to segment your conversations between different teams and functions, and can also be used to work around staff absences and unexpected technical issues.';
  const P2 = 'Unfortunately, well-managed team inboxes are the exception rather than the rule. Though many organizations use at least one shared inbox, few managers know how to manage them, let alone get the most out of them.';
  const P3 = 'In this guide, we’ll take you through the key techniques in managing shared inboxes, show you how to stay on top of problems as they arise, and ultimately make your teams more transparent, adaptive and effective.';

  const rows = [
    ['tgopinath1992@gmail.com', 'design', 'Regarding new views in the teaminbox', 'Nam porttitor blandit accumsan. Ut vel dictum sem, a pretium dui. In malesuada enim in dolor euismod.', ['official', 'important'], 'Donald Torres', 3, 2, 'open', true],
    ['Jack Boyd', 'igarage', 'I have hinted that I would often je.', 'I have hinted that I would often je vel dictum sem, a pretium dui.', ['progress', 'important'], 'Jordan Jordan', 0, 0, 'open'],
    ['Carolyn Morrison', 'tech', 'In the tumultuous business of cutting-in', 'In the tumultuous business of cutting-in and attending to a whale.', ['almost', 'important'], 'Emily Murray', 0, 0, 'unassigned'],
    ['ewatson@leenti.info', 'design', 'I have hinted that I would often jerk poor Queequeg', 'I have hinted that I would often jerk poor Queequeg from between the whale and the ship.', ['review'], 'Billy McDonald', 0, 0, 'open', false, 'Document.zip'],
    ['Jennifer Boyd', 'meta', 'The monkey-rope is found in all whalers', 'The monkey-rope is found in all whalers; but it was only in the Pequod.', [], 'Bryan Stewart', 0, 0, 'archived'],
    ['sturner@cogidoo.biz', 'design', 'So strongly and metaphysically did I conceive', 'So strongly and metaphysically did I conceive of my situation then.', ['progress'], 'Johnny Dixon', 3, 0, 'unassigned'],
    ['Sara Burton', 'igarage', 'Banjo tote bag bicycle rights, High Life', 'Banjo tote bag bicycle rights, High Life sartorial, cray craft beer.', [], 'Jerry Jones', 0, 0, 'open'],
    ['Janet Bates', 'tech', 'Team discussion regarding new design', 'Team discussion regarding new design for the shared inbox list.', [], 'Steven Crawford', 0, 15, 'open'],
    ['emorales@centidel.biz', 'igarage', 'Portland ugh fashion axe Helvetica', 'Portland ugh fashion axe Helvetica, YOLO Echo Park Austin.', [], 'Judith Diaz', 2, 0, 'archived'],
    ['Jacob Barnett', 'igarage', 'Guide for Teaminbox', 'In this guide, we’ll take you through the key techniques.', ['official'], 'Eugene Simmons', 0, 0, 'unassigned'],
    ['Jordan Williamson', 'tech', 'Synth polaroid bitters chillwave pickled', 'Synth polaroid bitters chillwave pickled. Vegan disrupt.', ['almost', 'official'], 'George Harvey', 0, 0, 'open'],
    ['Philip Graham', 'igarage', 'Night mode', 'Teaminbox give you best feel while working late.', [], 'Nicholas Fisher', 0, 0, 'archived'],
    ['Denise Rogers', 'meta', 'It was a humorously perilous business', 'It was a humorously perilous business for both of us.', [], 'Cheryl Sims', 0, 25, 'open'],
    ['Jane Russell', 'tech', 'Kogi Cosby sweater ethical squid irony', 'Kogi Cosby sweater ethical squid irony disrupt, organic.', ['review', 'almost'], 'Hannah May', 0, 0, 'unassigned'],
    ['Dylan Guerrero', 'design', 'Reg : Teaminbox themes', 'Teaminbox themes, comes with various colours for every team.', [], 'Randy Graham', 2, 0, 'open', false, 'Document.img'],
    ['lrose@jaxbean.gov', 'design', 'Being the savage’s bowsman, that is', 'Being the savage’s bowsman, that is, the person who pulled the bow-oar.', ['important'], 'Donald Torres', 0, 0, 'archived'],
    ['Thomas Guzman', 'igarage', 'Conversations between different teams', 'Conversations between different teams and functions in one place.', [], 'Emily Murray', 0, 0, 'unassigned'],
    ['Grace Newman', 'tech', 'Teaminbox give you best feel while', 'Teaminbox give you best feel while you collaborate.', ['progress'], 'Jordan Jordan', 0, 0, 'open'],
    ['Timothy Day', 'igarage', 'Follow up after the holidays', 'Remind me once the team is back from the long weekend.', [], 'George Harvey', 0, 0, 'snoozed'],
    ['Samuel Baker', 'tech', 'Quarterly review deck', 'Waiting on numbers from finance before we pick this up.', ['progress'], 'Hannah May', 0, 0, 'snoozed'],
    ['hprice@thoughtstorm.mil', 'design', 'Old newsletter draft', 'Superseded by the new template, safe to clean up.', [], 'Cheryl Sims', 0, 0, 'trash'],
    ['Win a free cruise', 'design', 'You have been selected!!!', 'Click the link below to claim your prize before it expires.', [], 'Randy Graham', 0, 0, 'spam'],
  ];
  const MEMBERS = {
    inbox: [['Gopinath T', 'tgopinath@zohocorp.com', true], ['Murali Krishna Kanakatla', 'murali.k@zohocorp.com'], ['Munusamy S', 'munusamy.s@zohocorp.com'], ['Saravanan Veerasamy', 'saravanan.v@zohocorp.com'], ['Geetha D', 'geetha.d@zohocorp.com']],
    org: [['Sujithra R', 'sujithra.r@zohocorp.com'], ['Rajaraja Chozhan', 'rajaraja.c@zohocorp.com'], ['Shruthi Q', 'shruthi.q@zohocorp.com'], ['Lalitha R', 'lalitha.r@zohocorp.com']],
  };

  const dockets = rows.map((r, i) => ({
    id: i + 1,
    from: r[0], inbox: r[1], subject: r[2], preview: r[3], tags: r[4], assignee: r[5],
    thread: r[6], discussions: r[7], status: r[8], unread: !!r[9], attachment: r[10] || null,
    ch: INBOXES.find((x) => x.id === r[1]).ch,
    date: 'Thu Nov 18 2021 17:49:37 GM',
    short: 'THU NOV 19',
    body: [P1, P2, P3],
  }));

  return { INBOXES, TAGS, dockets, MEMBERS };
})();
