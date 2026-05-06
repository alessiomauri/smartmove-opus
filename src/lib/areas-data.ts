/**
 * Costa del Sol area data for SEO-optimized location pages.
 * Each area has unique content, coordinates, and metadata for dedicated landing pages.
 */

export interface AreaData {
  name: string;
  slug: string;
  /** The parent municipality or broader region */
  region: 'Marbella' | 'Estepona' | 'Benahavis' | 'Mijas' | 'Fuengirola' | 'Torremolinos' | 'Malaga' | 'Casares' | 'Manilva' | 'San Roque';
  /** SEO page title */
  title: string;
  /** Meta description (150-160 chars ideal) */
  metaDescription: string;
  /** Hero heading on the area page */
  heading: string;
  /** Subheading below the hero */
  subheading: string;
  /** Main body content - 2-3 paragraphs of unique SEO content */
  description: string;
  /** Property types commonly found */
  propertyTypes: string[];
  /** Key highlights / selling points */
  highlights: string[];
  /** GPS coordinates for map */
  coordinates: { lat: number; lng: number };
  /** Average price range for context */
  priceRange: string;
  /** Nearby areas for internal linking */
  nearbyAreas: string[];
  /** Long-tail SEO keywords */
  keywords: string[];
  /** Whether this is a micro-location within a larger area */
  isMicroLocation: boolean;
  /** Parent area slug if micro-location */
  parentArea?: string;
}

export const COSTA_DEL_SOL_AREAS: AreaData[] = [
  // ═══════════════════════════════════════════
  // MARBELLA MUNICIPALITY
  // ═══════════════════════════════════════════
  {
    name: 'Marbella',
    slug: 'marbella',
    region: 'Marbella',
    title: 'Luxury Property for Sale in Marbella | Villas & Apartments',
    metaDescription: 'Browse exclusive luxury villas, apartments, and penthouses for sale in Marbella. The jewel of the Costa del Sol with world-class amenities and Mediterranean lifestyle.',
    heading: 'Luxury Properties in Marbella',
    subheading: 'The jewel of the Costa del Sol, where Mediterranean elegance meets modern luxury living',
    description: `Marbella is the undisputed capital of luxury on the Costa del Sol, a city that seamlessly blends old-world Andalusian charm with contemporary sophistication. Its historic Old Town, with its narrow cobbled streets and orange tree-lined plazas, sits alongside some of Europe's most exclusive beachfront developments and world-renowned dining establishments.

The Marbella property market attracts discerning buyers from across the globe, drawn by its exceptional microclimate with over 320 days of sunshine, pristine beaches stretching 27 kilometres along the coast, and an unrivalled lifestyle offering. From the iconic Golden Mile to the prestigious Sierra Blanca hillside, Marbella offers an extraordinary diversity of luxury real estate.

Whether you seek a contemporary beachfront villa, a classic Andalusian estate, or a sleek penthouse with panoramic sea views, Marbella delivers an investment that combines lifestyle excellence with enduring value in one of Europe's most sought-after destinations.`,
    propertyTypes: ['Luxury Villas', 'Penthouses', 'Apartments', 'Townhouses', 'Beachfront Properties'],
    highlights: ['27km of coastline', 'Historic Old Town', '320+ days of sunshine', 'World-class dining', 'International schools', 'Private hospitals'],
    coordinates: { lat: 36.5100, lng: -4.8860 },
    priceRange: 'From €500,000 to €30,000,000+',
    nearbyAreas: ['golden-mile', 'sierra-blanca', 'nueva-andalucia', 'marbella-east', 'san-pedro'],
    keywords: ['Marbella property for sale', 'luxury villas Marbella', 'Marbella real estate', 'buy property Marbella', 'Marbella apartments', 'Marbella penthouses', 'homes for sale Marbella Spain'],
    isMicroLocation: false,
  },
  {
    name: 'Golden Mile',
    slug: 'golden-mile',
    region: 'Marbella',
    title: 'Golden Mile Properties for Sale | Marbella\'s Most Prestigious Address',
    metaDescription: 'Discover luxury villas and apartments for sale on Marbella\'s Golden Mile. The most prestigious beachfront stretch between Marbella and Puerto Banus.',
    heading: 'Properties on the Golden Mile',
    subheading: 'Marbella\'s most coveted beachfront address, where prestige meets the Mediterranean',
    description: `The Golden Mile is Marbella's most exclusive and recognisable address, a legendary stretch of prime beachfront real estate connecting the heart of Marbella to the glamour of Puerto Banus. This iconic boulevard is home to five-star hotels, Michelin-starred restaurants, and some of the most prestigious residential developments on the entire Costa del Sol.

Properties on the Golden Mile command premium values thanks to their unmatched location, offering direct beach access and proximity to everything Marbella has to offer. The area is characterised by gated communities with lush tropical gardens, state-of-the-art security, and architectural designs ranging from classic Mediterranean to cutting-edge contemporary.

Living on the Golden Mile means being at the epicentre of Marbella's luxury lifestyle, with the Puente Romano resort, Marbella Club Hotel, and an array of beach clubs just moments from your door. It remains the benchmark for luxury coastal living in southern Spain.`,
    propertyTypes: ['Beachfront Villas', 'Luxury Apartments', 'Penthouses', 'Duplex Apartments'],
    highlights: ['Beachfront living', 'Puente Romano & Marbella Club', '5-star hotel neighbours', 'Walking distance to town', 'Gated communities', 'Beach clubs'],
    coordinates: { lat: 36.5035, lng: -4.9060 },
    priceRange: 'From €1,000,000 to €25,000,000+',
    nearbyAreas: ['marbella', 'sierra-blanca', 'puerto-banus', 'nagueles'],
    keywords: ['Golden Mile property for sale', 'Golden Mile villas', 'Marbella Golden Mile apartments', 'beachfront property Golden Mile', 'luxury homes Golden Mile Marbella'],
    isMicroLocation: true,
    parentArea: 'marbella',
  },
  {
    name: 'Sierra Blanca',
    slug: 'sierra-blanca',
    region: 'Marbella',
    title: 'Sierra Blanca Villas for Sale | Exclusive Gated Community Marbella',
    metaDescription: 'Explore exclusive villas for sale in Sierra Blanca, Marbella\'s most prestigious gated hillside community with panoramic sea and mountain views.',
    heading: 'Villas in Sierra Blanca',
    subheading: 'Marbella\'s most exclusive hillside enclave, privacy, prestige, and panoramic views',
    description: `Sierra Blanca is Marbella's most prestigious residential enclave, an exclusive gated community nestled on the hillside above the Golden Mile. This ultra-private neighbourhood is home to some of the most impressive mansions on the Costa del Sol, offering breathtaking panoramic views of the Mediterranean Sea, the African coastline, and the dramatic La Concha mountain.

The community is characterised by grand estates set on generous plots, surrounded by mature gardens and protected by 24-hour security. Architectural styles range from palatial Mediterranean villas to sleek contemporary masterpieces, many designed by internationally acclaimed architects. The sense of space, privacy, and exclusivity here is unmatched anywhere on the coast.

Sierra Blanca's elevated position provides a unique microclimate that is slightly cooler in summer, while its proximity to Marbella centre, the Golden Mile, and international schools makes it the address of choice for families and high-net-worth individuals seeking the ultimate in luxury living.`,
    propertyTypes: ['Luxury Villas', 'Mansions', 'Modern Villas', 'Estates'],
    highlights: ['24-hour gated security', 'Panoramic sea views', 'La Concha mountain backdrop', 'Ultra-private plots', '5 min to Golden Mile', 'International schools nearby'],
    coordinates: { lat: 36.5215, lng: -4.8995 },
    priceRange: 'From €3,000,000 to €30,000,000+',
    nearbyAreas: ['golden-mile', 'marbella', 'nagueles', 'nueva-andalucia'],
    keywords: ['Sierra Blanca villas for sale', 'Sierra Blanca Marbella', 'luxury villas Sierra Blanca', 'gated community Marbella', 'exclusive villas Marbella hillside'],
    isMicroLocation: true,
    parentArea: 'marbella',
  },
  {
    name: 'Nueva Andalucia',
    slug: 'nueva-andalucia',
    region: 'Marbella',
    title: 'Nueva Andalucia Property for Sale | Golf Valley Villas & Apartments',
    metaDescription: 'Find luxury villas and apartments for sale in Nueva Andalucia, Marbella\'s famous Golf Valley. Home to Las Brisas, Aloha, and Los Naranjos golf courses.',
    heading: 'Properties in Nueva Andalucia',
    subheading: 'The Golf Valley, where championship courses meet luxury Mediterranean living',
    description: `Nueva Andalucia, widely known as the "Golf Valley," is one of Marbella's most desirable residential areas and home to three of the Costa del Sol's finest golf courses: Real Club de Golf Las Brisas, Aloha Golf Club, and Los Naranjos Golf Club. This vibrant neighbourhood offers an exceptional quality of life with a perfect balance of luxury living, sporting excellence, and social energy.

The property landscape in Nueva Andalucia is remarkably diverse, ranging from contemporary villas with infinity pools overlooking the fairways to elegant apartments in boutique developments, and charming townhouses in mature urbanisations. The area has seen significant modern development in recent years, with striking contemporary architecture reshaping the skyline.

Beyond golf, Nueva Andalucia boasts a lively dining scene centred around the popular Centro Plaza, excellent connectivity to Puerto Banus and Marbella, and a strong international community that creates a welcoming, cosmopolitan atmosphere. It consistently ranks among the most popular areas for property investment on the Costa del Sol.`,
    propertyTypes: ['Golf Villas', 'Contemporary Villas', 'Apartments', 'Townhouses', 'Penthouses'],
    highlights: ['3 championship golf courses', 'Centro Plaza dining', 'Close to Puerto Banus', 'International community', 'Modern developments', 'Family-friendly'],
    coordinates: { lat: 36.4987, lng: -4.9490 },
    priceRange: 'From €400,000 to €15,000,000+',
    nearbyAreas: ['puerto-banus', 'golden-mile', 'la-quinta', 'san-pedro', 'sierra-blanca'],
    keywords: ['Nueva Andalucia property for sale', 'Golf Valley Marbella', 'villas Nueva Andalucia', 'apartments Nueva Andalucia', 'golf property Marbella', 'Nueva Andalucia real estate'],
    isMicroLocation: true,
    parentArea: 'marbella',
  },
  {
    name: 'Puerto Banus',
    slug: 'puerto-banus',
    region: 'Marbella',
    title: 'Puerto Banus Property for Sale | Apartments & Penthouses',
    metaDescription: 'Luxury apartments and penthouses for sale in Puerto Banus, Marbella. The glamorous marina destination with designer shopping, dining, and nightlife.',
    heading: 'Properties in Puerto Banus',
    subheading: 'The playground of the elite, luxury living in Marbella\'s iconic marina destination',
    description: `Puerto Banus is Marbella's most glamorous address, an iconic marina destination that has attracted the international jet set since it was inaugurated in 1970 by the Aga Khan. Today, the port is a dazzling showcase of superyachts, designer boutiques, world-class restaurants, and vibrant nightlife that pulses with energy throughout the year.

The property market around Puerto Banus caters to those who want to be at the heart of the action. Luxury penthouses with marina views, sleek apartments in modern developments, and elegant beachfront residences offer every conceivable lifestyle option. Many properties here are as much lifestyle investments as they are homes, with strong rental demand from the international tourist market.

Whether you prefer watching the sunset from a rooftop terrace overlooking the superyachts or strolling along the beach to the famous Nikki Beach club, Puerto Banus delivers an unmatchable energy and excitement that has made it synonymous with luxury Mediterranean living.`,
    propertyTypes: ['Penthouses', 'Luxury Apartments', 'Marina Apartments', 'Beachfront Residences'],
    highlights: ['Iconic marina', 'Designer shopping', 'Beach clubs', 'Fine dining', 'Nightlife', 'Strong rental market'],
    coordinates: { lat: 36.4880, lng: -4.9530 },
    priceRange: 'From €300,000 to €10,000,000+',
    nearbyAreas: ['nueva-andalucia', 'golden-mile', 'san-pedro', 'nueva-andalucia'],
    keywords: ['Puerto Banus property for sale', 'Puerto Banus apartments', 'penthouses Puerto Banus', 'luxury apartments Puerto Banus Marbella', 'marina property Marbella'],
    isMicroLocation: true,
    parentArea: 'marbella',
  },
  {
    name: 'Marbella East',
    slug: 'marbella-east',
    region: 'Marbella',
    title: 'Marbella East Properties for Sale | Beachfront Villas & Apartments',
    metaDescription: 'Discover beachfront properties for sale in Marbella East. Premium villas and apartments in Los Monteros, Elviria, and Cabopino with stunning sea views.',
    heading: 'Properties in Marbella East',
    subheading: 'Premium beachfront living along Marbella\'s eastern coastline',
    description: `Marbella East encompasses some of the Costa del Sol's most beautiful beachfront areas, stretching from the eastern edge of Marbella town towards Cabopino. This diverse stretch includes prestigious neighbourhoods such as Los Monteros, El Rosario, Elviria, Las Chapas, and the charming Cabopino marina, each offering a distinct character and lifestyle.

The area is renowned for its excellent beaches, many awarded Blue Flag status, and a more relaxed pace of life compared to the western side of Marbella. Properties range from impressive beachfront villas in Los Monteros to family-friendly apartments in Elviria and character-filled townhouses near Cabopino's picturesque port.

Marbella East has become increasingly popular with families thanks to excellent international schools, expansive green spaces, and a strong sense of community. The area also offers outstanding golf at Santa Maria and Cabopino courses, while the stunning sand dunes of Artola provide a protected natural landscape of exceptional beauty.`,
    propertyTypes: ['Beachfront Villas', 'Family Apartments', 'Townhouses', 'Penthouses'],
    highlights: ['Blue Flag beaches', 'Cabopino marina', 'International schools', 'Protected dunes', 'Family-oriented', 'Golf courses'],
    coordinates: { lat: 36.5050, lng: -4.8400 },
    priceRange: 'From €350,000 to €15,000,000+',
    nearbyAreas: ['marbella', 'los-monteros', 'elviria', 'cabopino'],
    keywords: ['Marbella East property for sale', 'beachfront property Marbella East', 'villas Marbella East', 'Elviria property', 'Cabopino apartments', 'Los Monteros villas'],
    isMicroLocation: false,
    parentArea: 'marbella',
  },
  {
    name: 'Los Monteros',
    slug: 'los-monteros',
    region: 'Marbella',
    title: 'Los Monteros Villas for Sale | Prestigious Beachfront Marbella East',
    metaDescription: 'Exclusive villas and properties for sale in Los Monteros, one of Marbella East\'s most prestigious beachfront neighbourhoods with elegant estates and sea views.',
    heading: 'Villas in Los Monteros',
    subheading: 'Elegant beachside living in one of Marbella\'s most established luxury neighbourhoods',
    description: `Los Monteros is one of Marbella's oldest and most prestigious residential areas, a distinguished beachfront neighbourhood that has been the address of choice for discerning buyers since the 1960s. Located on the eastern edge of Marbella, this exclusive enclave is defined by its grand villas set on generous plots, many with direct beach access and mature Mediterranean gardens.

The area takes its name from the legendary Los Monteros Hotel, a landmark that has hosted royalty and celebrities for decades. Properties here are characterised by their spacious layouts, privacy, and proximity to some of the finest stretches of beach on the entire coast. The architectural style tends towards classic elegance, with many original estates having been renovated to incorporate modern amenities while preserving their timeless character.

Los Monteros offers a quieter, more refined alternative to the western side of Marbella, while remaining just minutes from the town centre and all its amenities. It is particularly popular with established families and long-term residents who value space, tranquillity, and understated luxury.`,
    propertyTypes: ['Beachfront Villas', 'Luxury Estates', 'Modern Villas'],
    highlights: ['Direct beach access', 'Generous plot sizes', 'Established neighbourhood', '5 min to Marbella centre', 'Mature gardens', 'Privacy'],
    coordinates: { lat: 36.5020, lng: -4.8360 },
    priceRange: 'From €2,000,000 to €20,000,000+',
    nearbyAreas: ['marbella-east', 'marbella', 'elviria'],
    keywords: ['Los Monteros villas for sale', 'Los Monteros Marbella', 'beachfront villas Los Monteros', 'luxury property Los Monteros'],
    isMicroLocation: true,
    parentArea: 'marbella-east',
  },
  {
    name: 'San Pedro de Alcantara',
    slug: 'san-pedro',
    region: 'Marbella',
    title: 'San Pedro de Alcantara Property for Sale | Charming Coastal Town',
    metaDescription: 'Properties for sale in San Pedro de Alcantara, Marbella. A charming coastal town with a beautiful boulevard, local character, and excellent value luxury homes.',
    heading: 'Properties in San Pedro de Alcantara',
    subheading: 'Authentic Andalusian charm meets modern coastal living',
    description: `San Pedro de Alcantara is Marbella's charming western neighbour, a vibrant town that has transformed dramatically in recent years while retaining its authentic Andalusian soul. The spectacular new boulevard, one of the most impressive urban renewal projects on the Costa del Sol, has created a stunning pedestrian promenade connecting the town centre to the beach with parks, play areas, and cultural spaces.

The property market in San Pedro offers exceptional value compared to neighbouring areas like Puerto Banus and the Golden Mile, making it increasingly popular with savvy buyers who want luxury living without the premium price tag. The town offers everything from modern apartments in new developments to traditional townhouses in the historic centre and contemporary villas in surrounding urbanisations.

San Pedro has a genuine year-round community with excellent local amenities including traditional markets, tapas bars, and shops that serve residents rather than tourists. Its central location between Marbella and Estepona, combined with easy access to the AP-7 motorway, makes it an ideal base for exploring the entire Costa del Sol.`,
    propertyTypes: ['Apartments', 'Townhouses', 'Villas', 'New Developments', 'Penthouses'],
    highlights: ['New boulevard promenade', 'Authentic local character', 'Excellent value', 'Year-round community', 'Central location', 'Local markets'],
    coordinates: { lat: 36.4890, lng: -4.9920 },
    priceRange: 'From €250,000 to €5,000,000+',
    nearbyAreas: ['puerto-banus', 'nueva-andalucia', 'guadalmina', 'new-golden-mile'],
    keywords: ['San Pedro de Alcantara property for sale', 'San Pedro Marbella', 'apartments San Pedro', 'villas San Pedro de Alcantara', 'property San Pedro Costa del Sol'],
    isMicroLocation: true,
    parentArea: 'marbella',
  },
  {
    name: 'Guadalmina',
    slug: 'guadalmina',
    region: 'Marbella',
    title: 'Guadalmina Property for Sale | Golf & Beach Living Marbella',
    metaDescription: 'Luxury properties for sale in Guadalmina, Marbella. Prestigious golf and beach community with Guadalmina Alta hillside villas and Guadalmina Baja beachfront homes.',
    heading: 'Properties in Guadalmina',
    subheading: 'Where championship golf meets beachfront luxury on Marbella\'s western coast',
    description: `Guadalmina is one of Marbella's most established and sought-after residential areas, a prestigious community divided into two distinct zones: Guadalmina Baja (lower), offering beachfront living alongside the celebrated Guadalmina golf courses, and Guadalmina Alta (upper), providing elevated hillside properties with sweeping views towards the sea and mountains.

The area is centred around the Real Club de Golf Guadalmina, one of the Costa del Sol's most historic courses, which lends the neighbourhood its distinctive character. Properties in Guadalmina Baja range from elegant beachfront villas to well-appointed apartments within the golf resort, while Guadalmina Alta offers larger plots with panoramic views and a greater sense of privacy.

Guadalmina's appeal lies in its perfect balance of sporting lifestyle, natural beauty, and convenient location. Situated between San Pedro de Alcantara and Estepona, residents enjoy easy access to both towns while living in a peaceful, mature community surrounded by golf fairways, Mediterranean gardens, and some of the finest beaches on the coast.`,
    propertyTypes: ['Golf Villas', 'Beachfront Villas', 'Apartments', 'Townhouses'],
    highlights: ['Championship golf courses', 'Beachfront & hillside options', 'Mature community', 'Close to San Pedro', 'Family-friendly', 'Beach clubs'],
    coordinates: { lat: 36.4795, lng: -5.0065 },
    priceRange: 'From €400,000 to €10,000,000+',
    nearbyAreas: ['san-pedro', 'new-golden-mile', 'estepona', 'nueva-andalucia'],
    keywords: ['Guadalmina property for sale', 'Guadalmina Baja villas', 'Guadalmina Alta property', 'golf property Guadalmina Marbella', 'beachfront Guadalmina'],
    isMicroLocation: true,
    parentArea: 'marbella',
  },
  {
    name: 'Puente Romano',
    slug: 'puente-romano',
    region: 'Marbella',
    title: 'Puente Romano Properties for Sale | Iconic Beachfront Resort Living',
    metaDescription: 'Exclusive properties for sale at Puente Romano, Marbella\'s iconic beachfront resort on the Golden Mile. Luxury apartments and villas in a legendary setting.',
    heading: 'Properties at Puente Romano',
    subheading: 'Live within Marbella\'s most iconic beachfront resort, where legendary hospitality is home',
    description: `Puente Romano is not just a five-star resort, it is a lifestyle institution and one of the most recognisable names in European luxury hospitality. Set on the Golden Mile between Marbella and Puerto Banus, this legendary resort has been the destination of choice for royalty, celebrities, and international elite for decades.

Residential properties within and adjacent to the Puente Romano resort offer a truly unique proposition: the ability to live within the resort grounds and enjoy its world-class amenities as part of daily life. This includes access to the exclusive beach club, multiple restaurants including Nobu and Dani Garcia's establishments, a renowned tennis club, and beautifully maintained subtropical gardens.

Owning property at Puente Romano represents the pinnacle of the Marbella lifestyle, a seamless blend of resort-level service with the comfort and privacy of home. Properties here are rare and highly coveted, making them among the most resilient investments on the entire Costa del Sol.`,
    propertyTypes: ['Resort Apartments', 'Penthouses', 'Villas', 'Duplex Apartments'],
    highlights: ['Iconic 5-star resort', 'Nobu & fine dining', 'Tennis club', 'Beach club access', 'Subtropical gardens', 'Golden Mile location'],
    coordinates: { lat: 36.5050, lng: -4.9050 },
    priceRange: 'From €1,500,000 to €15,000,000+',
    nearbyAreas: ['golden-mile', 'marbella-club', 'sierra-blanca', 'marbella'],
    keywords: ['Puente Romano property for sale', 'Puente Romano apartments', 'Puente Romano Marbella', 'luxury property Puente Romano', 'Golden Mile resort property'],
    isMicroLocation: true,
    parentArea: 'golden-mile',
  },

  // ═══════════════════════════════════════════
  // BENAHAVIS MUNICIPALITY
  // ═══════════════════════════════════════════
  {
    name: 'Benahavis',
    slug: 'benahavis',
    region: 'Benahavis',
    title: 'Benahavis Property for Sale | Mountain Luxury & Golf Estates',
    metaDescription: 'Luxury villas and estates for sale in Benahavis, the gourmet village with mountain views, championship golf, and some of the Costa del Sol\'s finest properties.',
    heading: 'Properties in Benahavis',
    subheading: 'The gourmet village, mountain luxury, championship golf, and exceptional dining',
    description: `Benahavis is a picturesque mountain village perched above the Costa del Sol, renowned for having more restaurants per capita than any other municipality in Spain, earning it the well-deserved title of the "dining room of the Costa del Sol." This charming whitewashed village, with its dramatic mountain setting and riverside terraces, offers a lifestyle that perfectly balances rustic Andalusian authenticity with world-class luxury.

The municipality of Benahavis encompasses some of the most prestigious developments on the coast, including La Zagaleta, El Madroñal, La Quinta, Monte Mayor, and Los Flamingos. The area offers an extraordinary diversity of properties, from intimate village houses to sprawling hillside estates with panoramic views. Championship golf courses thread through the landscape, making it a paradise for golf enthusiasts.

Benahavis appeals to buyers seeking space, nature, and exclusivity without sacrificing accessibility, the coast and Puerto Banus are just 15 minutes away. The village itself comes alive in the evenings with locals and visitors dining al fresco in its famous restaurants, creating a warm, convivial atmosphere that epitomises the very best of Andalusian living.`,
    propertyTypes: ['Mountain Villas', 'Luxury Estates', 'Golf Properties', 'Country Houses', 'Modern Villas'],
    highlights: ['Gourmet dining capital', 'Mountain scenery', 'La Zagaleta nearby', 'Championship golf', '15 min to coast', 'Village charm'],
    coordinates: { lat: 36.5230, lng: -5.0500 },
    priceRange: 'From €350,000 to €30,000,000+',
    nearbyAreas: ['la-zagaleta', 'la-quinta', 'nueva-andalucia', 'el-madroñal'],
    keywords: ['Benahavis property for sale', 'Benahavis villas', 'Benahavis real estate', 'mountain villas Benahavis', 'golf property Benahavis', 'luxury homes Benahavis'],
    isMicroLocation: false,
  },
  {
    name: 'La Zagaleta',
    slug: 'la-zagaleta',
    region: 'Benahavis',
    title: 'La Zagaleta Villas for Sale | Europe\'s Most Exclusive Gated Community',
    metaDescription: 'Discover ultra-luxury villas for sale in La Zagaleta, Europe\'s most exclusive gated estate in Benahavis with two private golf courses and unmatched security.',
    heading: 'Villas in La Zagaleta',
    subheading: 'Europe\'s most exclusive private estate, where ultimate luxury finds its home',
    description: `La Zagaleta is widely regarded as the most exclusive and secure residential estate in Europe, a 900-hectare private paradise in the mountains of Benahavis that sets the standard for ultra-luxury living. With just 240 plots across its vast landscape, the estate offers an unrivalled sense of space, privacy, and prestige that simply cannot be replicated elsewhere on the continent.

The estate features two private 18-hole golf courses, an equestrian centre, a helipad, and a private club house with fine dining, all reserved exclusively for residents and their guests. Security is absolute, with manned gates and patrols ensuring complete privacy. Properties within La Zagaleta are architectural masterpieces, often exceeding 1,000 square metres of built area on plots of 5,000 to 10,000 square metres.

Ownership at La Zagaleta is a statement of arrival at the very pinnacle of luxury real estate. The estate attracts a discreet international clientele of entrepreneurs, royalty, and global leaders who value privacy above all else while enjoying one of the most beautiful natural settings on the Mediterranean coast.`,
    propertyTypes: ['Ultra-Luxury Villas', 'Mansions', 'Estates'],
    highlights: ['900-hectare private estate', 'Two private golf courses', 'Maximum 240 plots', 'Helipad', 'Equestrian centre', 'Ultimate privacy'],
    coordinates: { lat: 36.5274, lng: -5.0105 },
    priceRange: 'From €5,000,000 to €35,000,000+',
    nearbyAreas: ['benahavis', 'el-madroñal', 'la-quinta'],
    keywords: ['La Zagaleta villas for sale', 'La Zagaleta property', 'La Zagaleta Benahavis', 'most exclusive gated community Europe', 'ultra-luxury villas Spain'],
    isMicroLocation: true,
    parentArea: 'benahavis',
  },
  {
    name: 'La Quinta',
    slug: 'la-quinta',
    region: 'Benahavis',
    title: 'La Quinta Property for Sale | Golf Resort Living Benahavis',
    metaDescription: 'Properties for sale in La Quinta, Benahavis. A prestigious golf resort community with panoramic views, luxury villas, and a championship course.',
    heading: 'Properties in La Quinta',
    subheading: 'Resort-style golf living with panoramic views in the hills of Benahavis',
    description: `La Quinta is a prestigious golf resort community nestled in the foothills of Benahavis, offering a compelling combination of championship golf, panoramic views, and a diverse selection of quality properties. The La Quinta Golf & Country Club serves as the centrepiece of this established community, its undulating fairways providing a stunning green backdrop to the surrounding residential developments.

The property offering in La Quinta is notably varied, ranging from well-appointed apartments and townhouses ideal for holiday use or rental investment, to substantial villas with private pools and sweeping views towards the coast. Several modern developments have added contemporary architectural options to the traditional Mediterranean-style properties that characterise the original urbanisation.

La Quinta's elevated position provides exceptional views and a pleasant microclimate, while its location between Benahavis village and the coast offers convenient access to both. The community atmosphere is international yet intimate, with a strong emphasis on outdoor living, golf, and the relaxed pace of life that defines the best of the Costa del Sol.`,
    propertyTypes: ['Golf Villas', 'Apartments', 'Townhouses', 'Penthouses', 'Modern Villas'],
    highlights: ['Championship golf course', 'Panoramic views', 'Resort amenities', 'Between coast & mountains', 'International community', 'Varied price range'],
    coordinates: { lat: 36.5174, lng: -4.9844 },
    priceRange: 'From €300,000 to €8,000,000+',
    nearbyAreas: ['benahavis', 'nueva-andalucia', 'la-zagaleta', 'real-de-la-quinta'],
    keywords: ['La Quinta property for sale', 'La Quinta Benahavis', 'golf resort La Quinta', 'villas La Quinta Marbella', 'apartments La Quinta'],
    isMicroLocation: true,
    parentArea: 'benahavis',
  },
  {
    name: 'Real de La Quinta',
    slug: 'real-de-la-quinta',
    region: 'Benahavis',
    title: 'Real de La Quinta Villas for Sale | Eco-Luxury Living Benahavis',
    metaDescription: 'Exclusive eco-luxury villas for sale in Real de La Quinta, Benahavis. A pioneering sustainable development with panoramic views and low-density living.',
    heading: 'Villas in Real de La Quinta',
    subheading: 'Pioneering eco-luxury living with breathtaking views in Benahavis',
    description: `Real de La Quinta is a visionary residential development in the hills of Benahavis that sets new standards for sustainable luxury living on the Costa del Sol. This exclusive low-density community combines cutting-edge eco-architecture with the natural beauty of its elevated mountain setting, offering a lifestyle where luxury and environmental consciousness exist in harmony.

The development features spacious contemporary villas designed with sustainability at their core, incorporating renewable energy systems, natural materials, and bioclimatic design principles. Every residence is oriented to maximise the spectacular panoramic views that sweep from the Mediterranean Sea to the Ronda mountains, creating a living experience that is both visually stunning and ecologically responsible.

Real de La Quinta appeals to a new generation of luxury buyers who value quality, sustainability, and authenticity. Its location in the hills above Benahavis provides peaceful seclusion while remaining well-connected to the coast, making it an ideal choice for those seeking a forward-thinking approach to luxury Mediterranean living.`,
    propertyTypes: ['Eco Villas', 'Contemporary Villas', 'Sustainable Homes'],
    highlights: ['Eco-luxury design', 'Panoramic sea views', 'Low density', 'Sustainable living', 'Mountain setting', 'Contemporary architecture'],
    coordinates: { lat: 36.5240, lng: -4.9720 },
    priceRange: 'From €1,500,000 to €6,000,000+',
    nearbyAreas: ['la-quinta', 'benahavis', 'la-zagaleta'],
    keywords: ['Real de La Quinta property for sale', 'Real de La Quinta Benahavis', 'eco-luxury villas Marbella', 'sustainable property Costa del Sol'],
    isMicroLocation: true,
    parentArea: 'benahavis',
  },
  {
    name: 'El Madroñal',
    slug: 'el-madroñal',
    region: 'Benahavis',
    title: 'El Madroñal Villas for Sale | Mountain Luxury Living Benahavis',
    metaDescription: 'Luxury mountain villas for sale in El Madroñal, Benahavis. Exclusive hillside community near La Zagaleta with panoramic views and generous plots.',
    heading: 'Villas in El Madroñal',
    subheading: 'Exclusive mountain living with generous estates and sweeping coastal views',
    description: `El Madroñal is an exclusive residential community situated in the mountains of Benahavis, positioned as the neighbour and natural complement to La Zagaleta. This prestigious hillside neighbourhood offers many of the same attributes as its ultra-luxury neighbour, stunning views, generous plots, and an exceptional sense of privacy, while providing a somewhat more accessible entry point to mountain luxury living.

Properties in El Madroñal are predominantly grand villas set on spacious plots, many enjoying panoramic views that stretch from the coastline to the mountains of the Serrania de Ronda. The architectural styles vary from traditional Andalusian to bold contemporary, with many properties featuring extensive outdoor entertaining areas, private pools, and beautifully landscaped grounds.

The community benefits from its proximity to Benahavis village with its famous restaurants, while the coast and Puerto Banus are easily reachable within 15 minutes. El Madroñal represents an excellent opportunity for buyers seeking the exclusivity and natural beauty of mountain living without the premium commanded by La Zagaleta.`,
    propertyTypes: ['Mountain Villas', 'Luxury Estates', 'Contemporary Villas'],
    highlights: ['Near La Zagaleta', 'Generous plots', 'Mountain views', 'Privacy', '15 min to coast', 'Benahavis dining'],
    coordinates: { lat: 36.5380, lng: -5.0270 },
    priceRange: 'From €1,500,000 to €12,000,000+',
    nearbyAreas: ['la-zagaleta', 'benahavis', 'la-quinta'],
    keywords: ['El Madroñal villas for sale', 'El Madroñal Benahavis', 'mountain villas Benahavis', 'luxury property El Madroñal'],
    isMicroLocation: true,
    parentArea: 'benahavis',
  },
  {
    name: 'Finca Cortesin',
    slug: 'finca-cortesin',
    region: 'Benahavis',
    title: 'Finca Cortesin Properties for Sale | 5-Star Resort Living Casares',
    metaDescription: 'Exclusive properties for sale at Finca Cortesin, the acclaimed 5-star resort with championship golf, spa, and beach club between Estepona and Casares.',
    heading: 'Properties at Finca Cortesin',
    subheading: 'Five-star resort living at one of Europe\'s most acclaimed luxury destinations',
    description: `Finca Cortesin is one of Europe's most celebrated luxury resort destinations, an exquisite five-star property set amidst 532 acres of pristine Andalusian countryside between Estepona and Casares. The resort has garnered numerous international awards for its championship golf course, world-class spa, and exceptional dining, establishing itself as a benchmark for refined Mediterranean luxury.

Residential properties at Finca Cortesin offer the rare opportunity to live within a resort of this calibre while enjoying all its facilities as part of daily life. The villas and suites are designed in a restrained, elegant style that reflects the resort's philosophy of understated luxury, with clean architectural lines, premium natural materials, and seamless indoor-outdoor living spaces.

Residents have access to the resort's acclaimed facilities including the 18-hole championship golf course (host of the Solheim Cup), the 2,200 sqm spa, a private beach club, and several restaurants serving exceptional cuisine. Finca Cortesin represents a lifestyle investment of the highest order in one of the Costa del Sol's most beautifully maintained environments.`,
    propertyTypes: ['Resort Villas', 'Luxury Suites', 'Golf Properties'],
    highlights: ['5-star resort', 'Championship golf (Solheim Cup)', 'Award-winning spa', 'Beach club', 'Fine dining', '532 acres of grounds'],
    coordinates: { lat: 36.3790, lng: -5.1328 },
    priceRange: 'From €2,000,000 to €15,000,000+',
    nearbyAreas: ['casares', 'estepona', 'new-golden-mile'],
    keywords: ['Finca Cortesin property for sale', 'Finca Cortesin villas', 'Finca Cortesin Casares', 'luxury resort property Costa del Sol', 'golf resort Finca Cortesin'],
    isMicroLocation: true,
    parentArea: 'casares',
  },

  // ═══════════════════════════════════════════
  // ESTEPONA MUNICIPALITY
  // ═══════════════════════════════════════════
  {
    name: 'Estepona',
    slug: 'estepona',
    region: 'Estepona',
    title: 'Estepona Property for Sale | The Garden of the Costa del Sol',
    metaDescription: 'Discover properties for sale in Estepona, the Garden of the Costa del Sol. Beautiful old town, stunning new developments, and excellent value luxury homes.',
    heading: 'Properties in Estepona',
    subheading: 'The Garden of the Costa del Sol, beauty, value, and authentic Andalusian living',
    description: `Estepona has undergone one of the most remarkable transformations on the Costa del Sol, earning the title "Garden of the Costa del Sol" through an ambitious beautification programme that has turned the town into one of the most attractive destinations on the coast. Its stunning old town is a masterpiece of Andalusian charm, with flower-draped facades, colourful murals, and immaculate plazas that create an atmosphere of timeless beauty.

The Estepona property market has emerged as one of the most dynamic on the coast, offering exceptional value compared to Marbella while delivering an increasingly sophisticated lifestyle offering. New developments combine contemporary architecture with sustainable design, while the town's expanding promenade and marina provide an excellent backdrop for coastal living. The range of properties spans modern beachfront apartments to hillside villas with sea views.

Estepona's appeal extends well beyond aesthetics, the town offers excellent healthcare facilities, international schools, a thriving local community, and a genuine year-round lifestyle. Its growing reputation as a gastronomic destination, combined with improving infrastructure and connectivity, positions Estepona as one of the smartest luxury property investments on the Costa del Sol today.`,
    propertyTypes: ['Modern Apartments', 'Beachfront Properties', 'Villas', 'Townhouses', 'New Developments', 'Penthouses'],
    highlights: ['Garden of Costa del Sol', 'Beautiful old town', 'Excellent value', 'New marina', 'Growing gastronomy', 'Year-round community'],
    coordinates: { lat: 36.4270, lng: -5.1460 },
    priceRange: 'From €200,000 to €8,000,000+',
    nearbyAreas: ['new-golden-mile', 'casares', 'guadalmina', 'finca-cortesin'],
    keywords: ['Estepona property for sale', 'Estepona real estate', 'Estepona villas', 'Estepona apartments', 'luxury property Estepona', 'Garden of Costa del Sol', 'homes for sale Estepona Spain'],
    isMicroLocation: false,
  },
  {
    name: 'New Golden Mile',
    slug: 'new-golden-mile',
    region: 'Estepona',
    title: 'New Golden Mile Properties for Sale | Beachfront Living Estepona',
    metaDescription: 'Luxury beachfront properties for sale on the New Golden Mile between San Pedro and Estepona. Modern developments, beach clubs, and excellent value.',
    heading: 'Properties on the New Golden Mile',
    subheading: 'The new frontier of beachfront luxury between San Pedro and Estepona',
    description: `The New Golden Mile is the rapidly developing coastal corridor stretching from San Pedro de Alcantara westward to Estepona, an area that has become one of the most exciting property hotspots on the entire Costa del Sol. Named in reference to Marbella's original Golden Mile, this stretch offers a modern interpretation of beachfront luxury with contemporary developments, excellent infrastructure, and significantly better value.

The area has attracted major investment in recent years, with high-quality residential developments, luxury beach clubs, and improved road connections transforming what was once largely undeveloped coastline into a vibrant residential destination. Properties range from sleek modern apartments with sea views to impressive beachfront villas, many within gated communities offering pools, gardens, and security.

The New Golden Mile benefits from the best of both worlds: the cosmopolitan amenities of San Pedro and Puerto Banus to the east, and the charming authenticity of Estepona to the west. With several prominent beach clubs, the Laguna Village shopping centre, and continued development, this area represents arguably the best value for beachfront luxury living on the Costa del Sol.`,
    propertyTypes: ['Beachfront Apartments', 'Modern Villas', 'Penthouses', 'New Developments', 'Townhouses'],
    highlights: ['Beachfront developments', 'Excellent value', 'Beach clubs', 'Between San Pedro & Estepona', 'Modern architecture', 'Growing infrastructure'],
    coordinates: { lat: 36.4540, lng: -5.0410 },
    priceRange: 'From €250,000 to €5,000,000+',
    nearbyAreas: ['san-pedro', 'guadalmina', 'estepona'],
    keywords: ['New Golden Mile property for sale', 'New Golden Mile Estepona', 'beachfront New Golden Mile', 'apartments New Golden Mile', 'luxury property New Golden Mile'],
    isMicroLocation: true,
    parentArea: 'estepona',
  },
  {
    name: 'La Alqueria',
    slug: 'la-alqueria',
    region: 'Estepona',
    title: 'La Alqueria Properties for Sale | Modern Hillside Living Benahavis',
    metaDescription: 'Contemporary properties for sale in La Alqueria, a modern hillside development between Benahavis and Estepona with panoramic views and luxury amenities.',
    heading: 'Properties in La Alqueria',
    subheading: 'Contemporary hillside luxury with sweeping panoramic views',
    description: `La Alqueria is a modern residential development nestled in the hills between Benahavis and Estepona, an area that has become synonymous with contemporary architectural excellence on the Costa del Sol. The development sits at an elevation that provides sweeping panoramic views of the Mediterranean coastline, making every sunrise and sunset a spectacular private show.

The architectural character of La Alqueria is distinctly contemporary, with clean lines, floor-to-ceiling glazing, and open-plan living spaces designed to maximise the relationship between interior comfort and the extraordinary natural surroundings. Properties range from stylish apartments in boutique developments to impressive standalone villas, all sharing the same commitment to modern design and quality construction.

La Alqueria's location offers a perfect balance between elevation and accessibility, with the beaches and amenities of Estepona and the New Golden Mile within easy reach, while the mountain village of Benahavis with its renowned restaurants is equally close. The area particularly appeals to buyers with contemporary tastes who appreciate thoughtful design and a connection to the natural landscape.`,
    propertyTypes: ['Contemporary Villas', 'Modern Apartments', 'Penthouses', 'Townhouses'],
    highlights: ['Contemporary design', 'Panoramic views', 'Between coast & mountains', 'Modern developments', 'Quality construction', 'Growing area'],
    coordinates: { lat: 36.5020, lng: -4.9855 },
    priceRange: 'From €350,000 to €5,000,000+',
    nearbyAreas: ['benahavis', 'estepona', 'new-golden-mile', 'la-quinta'],
    keywords: ['La Alqueria property for sale', 'La Alqueria Benahavis', 'modern villas La Alqueria', 'contemporary property Marbella area'],
    isMicroLocation: true,
    parentArea: 'estepona',
  },

  // ═══════════════════════════════════════════
  // MIJAS MUNICIPALITY
  // ═══════════════════════════════════════════
  {
    name: 'Mijas',
    slug: 'mijas',
    region: 'Mijas',
    title: 'Mijas Property for Sale | Whitewashed Village & Coastal Living',
    metaDescription: 'Properties for sale in Mijas, from the charming whitewashed hilltop village to the bustling Mijas Costa coastline. Affordable luxury on the Costa del Sol.',
    heading: 'Properties in Mijas',
    subheading: 'From whitewashed mountain village to vibrant coast, Mijas offers it all',
    description: `Mijas is one of the most versatile and appealing municipalities on the Costa del Sol, encompassing everything from the iconic whitewashed hilltop village of Mijas Pueblo to the long, sun-drenched coastline of Mijas Costa. This diversity makes it one of the most popular choices for international buyers seeking value, variety, and authentic Spanish character.

Mijas Pueblo, perched dramatically above the coast, is one of the most photographed villages in Andalusia, with its winding streets, artisan workshops, and spectacular panoramic views. The village property market offers charming townhouses, rustic fincas, and modern villas set against this stunning backdrop. Meanwhile, Mijas Costa provides a wealth of beachfront apartments, golf properties, and family-friendly developments along its extensive coastline.

The municipality of Mijas benefits from excellent infrastructure, including two major golf courses at La Cala and Mijas Golf, numerous international schools, a large commercial centre at La Cañada, and easy access to both Malaga airport and the wider Costa del Sol. It represents outstanding value for buyers who want the Mediterranean lifestyle without the premium of the Marbella label.`,
    propertyTypes: ['Village Townhouses', 'Coastal Apartments', 'Villas', 'Fincas', 'Golf Properties'],
    highlights: ['Iconic whitewashed village', 'Extensive coastline', 'Excellent value', 'Golf courses', 'International schools', 'Close to airport'],
    coordinates: { lat: 36.5960, lng: -4.6360 },
    priceRange: 'From €150,000 to €3,000,000+',
    nearbyAreas: ['fuengirola', 'el-chaparral', 'benalmadena', 'marbella-east'],
    keywords: ['Mijas property for sale', 'Mijas Pueblo property', 'Mijas Costa apartments', 'property Mijas Costa del Sol', 'village house Mijas', 'golf property Mijas'],
    isMicroLocation: false,
  },
  {
    name: 'El Chaparral',
    slug: 'el-chaparral',
    region: 'Mijas',
    title: 'El Chaparral Properties for Sale | Golf & Beach Living Mijas Costa',
    metaDescription: 'Properties for sale in El Chaparral, Mijas Costa. A desirable golf and beach community between La Cala de Mijas and Fuengirola with excellent amenities.',
    heading: 'Properties in El Chaparral',
    subheading: 'Golf, beach, and community living on the Mijas coastline',
    description: `El Chaparral is a well-established residential community on the Mijas Costa, centred around the El Chaparral Golf Club and its challenging links-style course designed by Pepe Gancedo. The area enjoys a prime position between La Cala de Mijas and Fuengirola, offering residents the best of coastal living with excellent amenities and a strong sense of community.

Properties in El Chaparral range from affordable apartments ideal for holiday homes or rental investments to spacious villas overlooking the golf course and coast. The area has benefited from steady development that has maintained a balanced mix of permanent residents and holiday homeowners, creating a vibrant community that remains active throughout the year.

El Chaparral's appeal lies in its combination of lifestyle value and location. The beach is within walking distance, the golf course is on the doorstep, and the commercial centres of both Fuengirola and La Cala provide comprehensive shopping, dining, and entertainment options. For buyers seeking an active, social lifestyle in a well-connected coastal setting, El Chaparral offers compelling value.`,
    propertyTypes: ['Golf Apartments', 'Villas', 'Townhouses', 'Penthouses'],
    highlights: ['Golf course', 'Beach walking distance', 'Strong community', 'Between La Cala & Fuengirola', 'Good rental potential', 'Year-round lifestyle'],
    coordinates: { lat: 36.5020, lng: -4.6840 },
    priceRange: 'From €150,000 to €1,500,000+',
    nearbyAreas: ['mijas', 'fuengirola', 'la-cala-de-mijas'],
    keywords: ['El Chaparral property for sale', 'El Chaparral Mijas Costa', 'golf property El Chaparral', 'apartments El Chaparral'],
    isMicroLocation: true,
    parentArea: 'mijas',
  },
  {
    name: 'La Cala de Mijas',
    slug: 'la-cala-de-mijas',
    region: 'Mijas',
    title: 'La Cala de Mijas Property for Sale | Charming Coastal Village',
    metaDescription: 'Properties for sale in La Cala de Mijas, a charming coastal village with sandy beaches, authentic Spanish character, and a popular expat community.',
    heading: 'Properties in La Cala de Mijas',
    subheading: 'Authentic coastal living with sandy beaches and village charm',
    description: `La Cala de Mijas is the most charming of the Mijas Costa villages, a traditional fishing settlement that has evolved into a vibrant year-round community while retaining its authentic Andalusian soul. The long sandy beach, beautiful paseo maritimo, and lively main square create a genuinely Spanish coastal atmosphere that has attracted a loyal international following.

The property market in La Cala offers outstanding value compared to Marbella, with a mix of beachfront apartments, townhouses in established urbanisations, and villas in the surrounding hillsides. Recent years have seen significant investment in quality new developments, raising the bar for contemporary coastal living while keeping prices accessible relative to neighbouring areas.

Beyond its property value proposition, La Cala offers excellent practical infrastructure including international schools, medical centres, a wide dining scene spanning traditional chiringuitos to modern restaurants, and strong transport links along the coast. It represents one of the Costa del Sol's best-kept secrets for families and retirees seeking genuine community life.`,
    propertyTypes: ['Beachfront Apartments', 'Townhouses', 'Villas', 'Penthouses', 'New Developments'],
    highlights: ['Long sandy beach', 'Authentic village square', 'Paseo maritimo', 'Year-round community', 'Excellent value', 'International schools'],
    coordinates: { lat: 36.4920, lng: -4.6660 },
    priceRange: 'From €180,000 to €3,000,000+',
    nearbyAreas: ['mijas', 'el-chaparral', 'mijas-golf', 'mijas-costa', 'fuengirola'],
    keywords: ['La Cala de Mijas property for sale', 'La Cala de Mijas apartments', 'La Cala Mijas beachfront', 'property La Cala de Mijas Costa del Sol', 'La Cala villas'],
    isMicroLocation: true,
    parentArea: 'mijas',
  },
  {
    name: 'Mijas Golf',
    slug: 'mijas-golf',
    region: 'Mijas',
    title: 'Mijas Golf Property for Sale | Championship Golf Living Mijas Costa',
    metaDescription: 'Properties for sale at Mijas Golf, home to two championship courses in the heart of the Costa del Sol. Golf villas, apartments, and townhouses with course views.',
    heading: 'Properties at Mijas Golf',
    subheading: 'Live within one of the Costa del Sol\'s most established golf communities',
    description: `Mijas Golf is a well-established residential and golfing community centred around the celebrated Mijas Golf Club, home to two 18-hole championship courses, Los Lagos and Los Olivos, that have welcomed golfers for over four decades. The area has matured into one of the most comfortable golfing addresses on the coast, with lush fairways, mature landscaping, and a genuine sense of community.

Properties at Mijas Golf range from apartments and townhouses enjoying direct course views to spacious villas in the surrounding hillsides. The architectural style tends toward classic Mediterranean, with many properties featuring private pools, generous terraces, and panoramic views over the rolling golf landscape toward the coast.

Residents enjoy proximity to the beaches of Mijas Costa, the commercial centres of Fuengirola and La Cala, and easy access to Malaga airport just 20 minutes away. For buyers for whom golf is a central lifestyle priority, Mijas Golf offers proven value in an established, well-managed community.`,
    propertyTypes: ['Golf Apartments', 'Golf Villas', 'Townhouses', 'Penthouses'],
    highlights: ['Two championship courses', 'Mature community', 'Course views', '20 min to airport', 'Beach proximity', 'Established golf club'],
    coordinates: { lat: 36.5395, lng: -4.6180 },
    priceRange: 'From €220,000 to €2,500,000+',
    nearbyAreas: ['mijas', 'mijas-costa', 'fuengirola', 'la-cala-de-mijas'],
    keywords: ['Mijas Golf property for sale', 'Mijas Golf apartments', 'golf villas Mijas', 'Los Lagos Los Olivos property', 'Mijas Golf Club property'],
    isMicroLocation: true,
    parentArea: 'mijas',
  },
  {
    name: 'Mijas Costa',
    slug: 'mijas-costa',
    region: 'Mijas',
    title: 'Mijas Costa Property for Sale | Beachfront Coastal Living Mijas',
    metaDescription: 'Beachfront properties for sale on Mijas Costa, the popular coastal stretch of Mijas with sandy beaches, golf, and excellent value luxury homes.',
    heading: 'Properties on Mijas Costa',
    subheading: 'Sandy beaches, year-round sunshine, and great-value coastal property',
    description: `Mijas Costa is the coastal stretch of Mijas municipality, running from Calahonda in the west to the edge of Fuengirola in the east. It encompasses a diverse coastline with some of the most accessible beachfront property on the Costa del Sol, including popular sub-areas such as Calahonda, La Cala de Mijas, and Riviera del Sol.

The property offering along Mijas Costa is remarkably varied, from beachfront apartments with direct access to the sand, to golf villas, modern penthouses, and townhouses in mature urbanisations. The area has long been favoured by Northern European buyers for its combination of outstanding value, reliable year-round climate, and strong rental demand from tourism.

Mijas Costa benefits from excellent infrastructure including the La Cala de Mijas commercial centre, several international schools, and direct access via the A-7 coastal highway. For buyers prioritising coastal lifestyle and value over prestige, Mijas Costa consistently offers some of the most compelling opportunities on the Costa del Sol.`,
    propertyTypes: ['Beachfront Apartments', 'Townhouses', 'Villas', 'Penthouses', 'Golf Properties'],
    highlights: ['Sandy beaches', 'Year-round lifestyle', 'Strong rental market', 'Excellent value', 'A-7 access', 'International community'],
    coordinates: { lat: 36.4870, lng: -4.7000 },
    priceRange: 'From €150,000 to €3,500,000+',
    nearbyAreas: ['mijas', 'la-cala-de-mijas', 'mijas-golf', 'el-chaparral', 'fuengirola'],
    keywords: ['Mijas Costa property for sale', 'Mijas Costa apartments', 'beachfront Mijas Costa', 'Calahonda property', 'Riviera del Sol property', 'coastal Mijas real estate'],
    isMicroLocation: true,
    parentArea: 'mijas',
  },

  // ═══════════════════════════════════════════
  // FUENGIROLA
  // ═══════════════════════════════════════════
  {
    name: 'Fuengirola',
    slug: 'fuengirola',
    region: 'Fuengirola',
    title: 'Fuengirola Property for Sale | Vibrant Coastal Town Costa del Sol',
    metaDescription: 'Properties for sale in Fuengirola, a vibrant year-round coastal town on the Costa del Sol with 8km of beaches, lively promenade, and excellent transport links.',
    heading: 'Properties in Fuengirola',
    subheading: 'Vibrant year-round living on the Costa del Sol with 8km of golden beaches',
    description: `Fuengirola is one of the Costa del Sol's most vibrant and best-connected towns, a bustling coastal destination that thrives year-round with a large permanent international community. Unlike many coastal resorts that quieten in winter, Fuengirola maintains its energy throughout the seasons, with an 8-kilometre promenade, lively markets, diverse dining, and a packed calendar of cultural events and festivals.

The property market in Fuengirola is notably accessible, offering everything from affordable beachfront apartments to modern penthouses with sea views, and family villas in the surrounding hills. The town's excellent transport connections, including a commuter train to Malaga airport and city centre, plus the AP-7 motorway, make it an ideal base for both permanent residents and those commuting to the wider region.

Fuengirola is especially popular with Scandinavian, British, and Dutch communities, creating a truly multicultural atmosphere with international restaurants, shops, and social clubs. The Sohail Castle, Bioparc zoo, and vibrant port area add cultural depth to a town that successfully balances tourist appeal with genuine residential liveability.`,
    propertyTypes: ['Beachfront Apartments', 'Penthouses', 'Townhouses', 'Villas', 'New Developments'],
    highlights: ['8km promenade', 'Year-round community', 'Train to Malaga/airport', 'Diverse dining', 'Sohail Castle', 'Multicultural'],
    coordinates: { lat: 36.5440, lng: -4.6250 },
    priceRange: 'From €120,000 to €2,000,000+',
    nearbyAreas: ['mijas', 'el-chaparral', 'benalmadena', 'torremolinos'],
    keywords: ['Fuengirola property for sale', 'Fuengirola apartments', 'buy property Fuengirola', 'Fuengirola real estate', 'beachfront apartment Fuengirola'],
    isMicroLocation: false,
  },

  // ═══════════════════════════════════════════
  // TORREMOLINOS
  // ═══════════════════════════════════════════
  {
    name: 'Torremolinos',
    slug: 'torremolinos',
    region: 'Torremolinos',
    title: 'Torremolinos Property for Sale | Classic Costa del Sol Resort Town',
    metaDescription: 'Properties for sale in Torremolinos, the original Costa del Sol resort town. Beachfront apartments and renovated properties minutes from Malaga airport.',
    heading: 'Properties in Torremolinos',
    subheading: 'The original Costa del Sol resort town, reinvented for modern coastal living',
    description: `Torremolinos holds a special place in Costa del Sol history as the destination that started it all, the resort that first put Spain's southern coast on the international tourism map in the 1960s. Today, the town is experiencing a renaissance, with thoughtful regeneration bringing new energy to its famous beaches, pedestrian streets, and vibrant social scene while honoring its colourful heritage.

The Torremolinos property market offers some of the most accessible entry points on the Costa del Sol, with beachfront apartments, renovated townhouses, and modern developments at prices that represent exceptional value given the location. The town's proximity to Malaga airport, just 10 minutes away, combined with direct train connections, makes it one of the most conveniently connected destinations on the coast.

La Carihuela, the charming former fishing village within Torremolinos, is particularly sought after for its authentic seafood restaurants, narrow streets, and beautiful beach. The town appeals strongly to buyers seeking a genuine year-round lifestyle with excellent infrastructure, healthcare, and a diverse international community at Costa del Sol's most accessible price point.`,
    propertyTypes: ['Beachfront Apartments', 'Renovated Townhouses', 'Penthouses', 'New Developments'],
    highlights: ['10 min to airport', 'Train connections', 'La Carihuela charm', 'Affordable entry', 'Year-round lifestyle', 'Beachfront living'],
    coordinates: { lat: 36.6210, lng: -4.5000 },
    priceRange: 'From €100,000 to €1,000,000+',
    nearbyAreas: ['benalmadena', 'malaga', 'fuengirola'],
    keywords: ['Torremolinos property for sale', 'Torremolinos apartments', 'beachfront Torremolinos', 'buy property Torremolinos', 'La Carihuela property'],
    isMicroLocation: false,
  },

  // ═══════════════════════════════════════════
  // MALAGA
  // ═══════════════════════════════════════════
  {
    name: 'Malaga',
    slug: 'malaga',
    region: 'Malaga',
    title: 'Malaga Property for Sale | Cultural Capital of the Costa del Sol',
    metaDescription: 'Properties for sale in Malaga, the cultural capital of the Costa del Sol. Historic centre, world-class museums, beaches, and a booming property market.',
    heading: 'Properties in Malaga',
    subheading: 'The cultural capital of the Costa del Sol, history, art, and urban sophistication',
    description: `Malaga has emerged as one of Spain's most exciting cities, a cultural powerhouse that rivals Barcelona and Madrid for museums, gastronomy, and urban sophistication. The birthplace of Picasso is home to over 40 museums and galleries, a stunning renovated historic centre, and a vibrant port area that has transformed the city's waterfront into one of the Mediterranean's most appealing urban spaces.

The Malaga property market has seen remarkable growth as international buyers discover the city's unique combination of urban culture, coastal lifestyle, and excellent connectivity. The historic centre offers beautifully restored apartments in characterful buildings, while modern developments along the eastern beaches and in emerging districts like Soho provide contemporary living options with all the energy of a thriving city.

Malaga's international airport connects the city to over 100 destinations worldwide, making it the gateway to the entire Costa del Sol. The AVE high-speed train links to Madrid in under 2.5 hours, while the expanding tech district of Malaga TechPark is attracting major companies and young professionals. For buyers seeking urban sophistication with Mediterranean warmth, Malaga offers an unmatched proposition.`,
    propertyTypes: ['City Apartments', 'Historic Centre Properties', 'Penthouses', 'Beachfront Apartments', 'New Developments'],
    highlights: ['40+ museums', 'Picasso\'s birthplace', 'International airport', 'AVE high-speed train', 'Booming tech sector', 'Vibrant gastronomy'],
    coordinates: { lat: 36.7213, lng: -4.4214 },
    priceRange: 'From €150,000 to €3,000,000+',
    nearbyAreas: ['torremolinos', 'benalmadena'],
    keywords: ['Malaga property for sale', 'Malaga real estate', 'apartments Malaga', 'buy property Malaga', 'Malaga city centre property', 'homes for sale Malaga Spain'],
    isMicroLocation: false,
  },

  // ═══════════════════════════════════════════
  // CASARES & MANILVA
  // ═══════════════════════════════════════════
  {
    name: 'Casares',
    slug: 'casares',
    region: 'Casares',
    title: 'Casares Property for Sale | Whitewashed Village & Coastal Living',
    metaDescription: 'Properties for sale in Casares, from the stunning whitewashed hilltop village to modern coastal developments. Emerging luxury destination on the western Costa del Sol.',
    heading: 'Properties in Casares',
    subheading: 'Where a dramatic hilltop village meets the emerging western Costa del Sol',
    description: `Casares is one of Andalusia's most visually dramatic villages, a cascading arrangement of whitewashed houses clinging to a steep hillside crowned by the ruins of a Moorish castle. This stunning pueblo blanco, birthplace of Blas Infante (the father of Andalusian nationalism), has preserved its authentic character while its coastal area, Casares Costa, has emerged as an exciting frontier for quality property development.

The Casares property market offers a compelling dual proposition. In the village itself, restored townhouses and rustic fincas provide authentic Andalusian living with spectacular mountain views at remarkably accessible prices. Along the coast, modern developments between Estepona and Manilva are delivering contemporary apartments and villas with sea views, often at a fraction of the cost of equivalent properties further east.

The municipality of Casares is home to the prestigious Finca Cortesin resort and its Solheim Cup golf course, lending international prestige to the area. With improving road connections, excellent local dining, and the unspoilt charm of both mountain and coastal settings, Casares represents one of the most promising emerging luxury destinations on the Costa del Sol.`,
    propertyTypes: ['Village Townhouses', 'Coastal Apartments', 'Modern Villas', 'Rustic Fincas', 'Golf Properties'],
    highlights: ['Dramatic hilltop village', 'Finca Cortesin resort', 'Emerging market', 'Excellent value', 'Authentic character', 'Mountain & coast'],
    coordinates: { lat: 36.3645, lng: -5.1520 },
    priceRange: 'From €120,000 to €8,000,000+',
    nearbyAreas: ['manilva', 'estepona', 'finca-cortesin', 'sotogrande'],
    keywords: ['Casares property for sale', 'Casares villas', 'Casares Costa apartments', 'whitewashed village property Spain', 'property Casares Costa del Sol'],
    isMicroLocation: false,
  },
  {
    name: 'Manilva',
    slug: 'manilva',
    region: 'Manilva',
    title: 'Manilva Property for Sale | Wine Country Meets the Coast',
    metaDescription: 'Properties for sale in Manilva on the western Costa del Sol. Wine country charm, beachfront living, and the most affordable luxury on the coast.',
    heading: 'Properties in Manilva',
    subheading: 'Wine country meets the coast, the western Costa del Sol\'s best-kept secret',
    description: `Manilva occupies the westernmost reaches of the Costa del Sol, a municipality where Andalusian wine-making traditions meet beautiful Mediterranean coastline. Known locally for its sweet Moscatel wine produced from vineyards that cascade down hillsides towards the sea, Manilva offers a distinctly authentic Spanish experience that contrasts refreshingly with the more developed resorts further east.

The coastal area of Manilva, centred around the attractive marina at Duquesa Port, has developed steadily into a popular residential destination. Properties range from affordable apartments near the marina to villas in hillside urbanisations with sea views, all at prices that make Manilva one of the most accessible luxury options on the entire Costa del Sol. The Duquesa marina itself is a charming hub of restaurants, bars, and shops.

Manilva's westward position places it within easy reach of Sotogrande and Gibraltar, while Estepona and Marbella are accessible along the coastal motorway. The area particularly appeals to buyers seeking value, authenticity, and a genuine year-round community, away from the tourist intensity of the central coast. With wine festivals, local markets, and spectacular sunsets over the Strait of Gibraltar, Manilva delivers a lifestyle that feels genuinely Mediterranean.`,
    propertyTypes: ['Marina Apartments', 'Hillside Villas', 'Townhouses', 'New Developments'],
    highlights: ['Duquesa Port marina', 'Wine country', 'Most affordable on coast', 'Near Sotogrande', 'Authentic community', 'Gibraltar views'],
    coordinates: { lat: 36.3480, lng: -5.2220 },
    priceRange: 'From €100,000 to €1,500,000+',
    nearbyAreas: ['casares', 'sotogrande', 'estepona'],
    keywords: ['Manilva property for sale', 'Manilva apartments', 'Duquesa Port property', 'property Manilva Costa del Sol', 'buy property Manilva'],
    isMicroLocation: false,
  },

  // ═══════════════════════════════════════════
  // SOTOGRANDE
  // ═══════════════════════════════════════════
  {
    name: 'Sotogrande',
    slug: 'sotogrande',
    region: 'San Roque',
    title: 'Sotogrande Property for Sale | Spain\'s Premier Polo & Golf Destination',
    metaDescription: 'Luxury properties for sale in Sotogrande, Spain\'s premier sporting estate. Home to Valderrama golf, Santa Maria Polo Club, and exclusive marina living.',
    heading: 'Properties in Sotogrande',
    subheading: 'Spain\'s premier sporting estate, where polo, golf, and luxury converge',
    description: `Sotogrande is Spain's largest privately-owned residential development and one of Europe's most prestigious sporting communities, situated on the coast of Cadiz province just 30 minutes from Gibraltar. This exclusive estate is defined by its world-class sporting facilities, most notably the legendary Real Club Valderrama, host of the 1997 Ryder Cup, and the Santa Maria Polo Club, the most important polo venue in continental Europe.

The residential landscape of Sotogrande is diverse and refined, encompassing the elegant marina with its waterfront apartments and restaurants, the established La Reserva development with its beach club and golf course, and the traditional residential areas with grand villas set behind mature hedgerows. The community has a distinctly international flavour, with prominent Spanish, British, and German communities creating a sophisticated social environment.

Sotogrande appeals to buyers who value sports, privacy, and a refined lifestyle in a setting that feels exclusive without being pretentious. The estate's comprehensive infrastructure includes international schools, equestrian facilities, tennis clubs, and a wide range of dining options. For those seeking the quintessential European sporting estate lifestyle, Sotogrande remains without equal on the southern Spanish coast.`,
    propertyTypes: ['Marina Apartments', 'Golf Villas', 'Polo Estate Homes', 'Penthouses', 'Townhouses'],
    highlights: ['Valderrama golf', 'Santa Maria Polo Club', 'Exclusive marina', 'International schools', '30 min to Gibraltar', 'La Reserva beach club'],
    coordinates: { lat: 36.2760, lng: -5.2718 },
    priceRange: 'From €300,000 to €15,000,000+',
    nearbyAreas: ['manilva', 'casares'],
    keywords: ['Sotogrande property for sale', 'Sotogrande villas', 'Sotogrande marina apartments', 'Valderrama golf property', 'polo property Sotogrande', 'luxury real estate Sotogrande'],
    isMicroLocation: false,
  },

  // ═══════════════════════════════════════════
  // ADDITIONAL MICRO-LOCATIONS
  // ═══════════════════════════════════════════
  {
    name: 'Elviria',
    slug: 'elviria',
    region: 'Marbella',
    title: 'Elviria Properties for Sale | Family-Friendly Beachfront Marbella East',
    metaDescription: 'Properties for sale in Elviria, a family-friendly beachfront community in Marbella East with international schools, Nikki Beach, and quality residential developments.',
    heading: 'Properties in Elviria',
    subheading: 'Family-friendly beachfront living with international flair in Marbella East',
    description: `Elviria is one of Marbella East's most popular residential communities, a family-friendly neighbourhood known for its excellent beaches, international schools, and the iconic Nikki Beach club. The area has developed into a vibrant year-round community that attracts families and professionals seeking a high quality of life in a well-established beachfront setting.

The property market in Elviria offers a broad range of options, from well-maintained apartments in established complexes to modern villas in newer developments. The area around Don Carlos Hotel and Nikki Beach is particularly desirable, while developments further inland towards the hills offer elevated positions with sea views at more accessible price points.

Elviria's family credentials are particularly strong, with The English International College and several other schools nearby, extensive sports facilities, and a safe, community-oriented atmosphere. The neighbourhood's excellent connectivity to Marbella centre and the motorway network makes it an ideal base for families who want beach lifestyle living with practical amenities close at hand.`,
    propertyTypes: ['Family Apartments', 'Beachfront Villas', 'Townhouses', 'New Developments'],
    highlights: ['Nikki Beach', 'International schools', 'Family-friendly', 'Don Carlos area', 'Year-round community', 'Diverse property range'],
    coordinates: { lat: 36.4930, lng: -4.8018 },
    priceRange: 'From €250,000 to €5,000,000+',
    nearbyAreas: ['marbella-east', 'los-monteros', 'cabopino'],
    keywords: ['Elviria property for sale', 'Elviria Marbella', 'family property Elviria', 'Nikki Beach Elviria', 'apartments Elviria Marbella East'],
    isMicroLocation: true,
    parentArea: 'marbella-east',
  },
  {
    name: 'El Rosario',
    slug: 'el-rosario',
    region: 'Marbella',
    title: 'El Rosario Properties for Sale | Marbella East',
    metaDescription: 'Properties for sale in El Rosario, a well-established residential area in Marbella East with excellent amenities and family-friendly appeal.',
    heading: 'Properties in El Rosario',
    subheading: 'Established family living in the heart of Marbella East',
    description: `El Rosario is one of the most established residential areas of Marbella East, known for its excellent infrastructure and family-friendly environment. Centred around the El Rosario commercial area with supermarkets, restaurants, and services, it offers a practical yet appealing base for families and professionals seeking the eastern Marbella lifestyle.

The area benefits from proximity to international schools, sports facilities, and sandy beaches, while remaining well connected to central Marbella via the coastal road. Properties range from spacious apartments in well-maintained communities to detached villas on generous plots with mountain or partial sea views.`,
    propertyTypes: ['Apartments', 'Family Villas', 'Townhouses', 'New Developments'],
    highlights: ['Established community', 'International schools', 'Commercial centre', 'Family-friendly', 'Good value', 'Beach access'],
    coordinates: { lat: 36.4985, lng: -4.8200 },
    priceRange: 'From €200,000 to €3,000,000+',
    nearbyAreas: ['marbella-east', 'elviria', 'los-monteros'],
    keywords: ['El Rosario property for sale', 'El Rosario Marbella', 'apartments El Rosario', 'family property Marbella East'],
    isMicroLocation: true,
    parentArea: 'marbella-east',
  },
  {
    name: 'Cabopino',
    slug: 'cabopino',
    region: 'Marbella',
    title: 'Cabopino Properties for Sale | Marbella East Beachfront',
    metaDescription: 'Properties for sale in Cabopino, a charming beachfront enclave in eastern Marbella with a picturesque marina and protected dunes.',
    heading: 'Properties in Cabopino',
    subheading: 'A hidden beachfront gem on the eastern edge of Marbella',
    description: `Cabopino is a coveted beachfront enclave at the eastern limit of Marbella municipality, renowned for its picturesque marina, natural sand dunes, and relaxed atmosphere. The protected Artola dunes give Cabopino a uniquely unspoilt character, with a beautiful sandy beach that feels miles from the busier stretches to the west.

The small marina at Cabopino is one of the most charming on the coast, lined with restaurants and cafes that come alive in summer. Properties here range from beachfront apartments overlooking the port to hillside villas with panoramic sea views, all benefiting from the area's distinctive combination of natural beauty and marina lifestyle.`,
    propertyTypes: ['Beachfront Apartments', 'Marina Apartments', 'Villas', 'Townhouses'],
    highlights: ['Artola dunes', 'Charming marina', 'Protected beach', 'Unspoilt character', 'Sea views', 'Eastern Marbella'],
    coordinates: { lat: 36.4850, lng: -4.7440 },
    priceRange: 'From €250,000 to €4,000,000+',
    nearbyAreas: ['marbella-east', 'elviria', 'el-rosario'],
    keywords: ['Cabopino property for sale', 'Cabopino Marbella', 'marina Cabopino', 'beachfront Cabopino', 'Artola dunes property'],
    isMicroLocation: true,
    parentArea: 'marbella-east',
  },
  // ═══════════════════════════════════════════
  // TRANSIT REFERENCE (not a property area, map pin only)
  // ═══════════════════════════════════════════
  {
    name: 'Málaga Airport',
    slug: 'malaga-airport',
    region: 'Malaga',
    title: 'Málaga-Costa del Sol Airport (AGP)',
    metaDescription: 'Málaga-Costa del Sol Airport (AGP), the main international gateway to the Costa del Sol.',
    heading: 'Málaga-Costa del Sol Airport',
    subheading: 'The main international gateway to the Costa del Sol',
    description: `Málaga-Costa del Sol Airport (IATA: AGP) is the principal international gateway to the Costa del Sol and Andalusia. Located roughly 40 minutes east of Marbella along the AP-7 motorway, it connects the coast to over 100 global destinations and handles more than 20 million passengers a year.

This entry exists as a transit reference point on the locations map. Málaga Airport is not a residential area; use the coloured pin to orient the distance between the main property regions and the airport.`,
    propertyTypes: [],
    highlights: ['IATA: AGP', '~40 min from Marbella', '100+ destinations', 'AVE rail connection', 'Open 24/7'],
    coordinates: { lat: 36.6749, lng: -4.4991 },
    priceRange: '',
    nearbyAreas: ['malaga', 'torremolinos', 'fuengirola'],
    keywords: ['Malaga airport', 'AGP airport', 'Costa del Sol airport', 'Marbella airport transfer'],
    isMicroLocation: false,
  },
];

/**
 * Get all area slugs for generateStaticParams
 */
export function getAllAreaSlugs(): string[] {
  return COSTA_DEL_SOL_AREAS.map(area => area.slug);
}

/**
 * Get area data by slug
 */
export function getAreaBySlug(slug: string): AreaData | undefined {
  return COSTA_DEL_SOL_AREAS.find(area => area.slug === slug);
}

/**
 * Get all major areas (non-micro-locations) for navigation
 */
export function getMajorAreas(): AreaData[] {
  return COSTA_DEL_SOL_AREAS.filter(area => !area.isMicroLocation);
}

/**
 * Get child micro-locations for a parent area
 */
export function getChildAreas(parentSlug: string): AreaData[] {
  return COSTA_DEL_SOL_AREAS.filter(area => area.parentArea === parentSlug);
}

/**
 * Get nearby area data objects from slugs
 */
export function getNearbyAreas(slugs: string[]): AreaData[] {
  return slugs
    .map(slug => getAreaBySlug(slug))
    .filter((area): area is AreaData => area !== undefined);
}

/**
 * All area names for the AREAS constant (used in filters)
 */
export const ALL_AREA_NAMES = COSTA_DEL_SOL_AREAS.map(area => area.name);
