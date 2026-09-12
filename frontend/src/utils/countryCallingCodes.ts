export interface CountryCallingCode {
  iso: string
  dial: string
  nameTr: string
  nameEn: string
}

export const DEFAULT_PHONE_COUNTRY_ISO = 'TR'

export const COUNTRY_CALLING_CODES: CountryCallingCode[] = [
  { iso: 'AF', dial: '93', nameTr: 'Afganistan', nameEn: 'Afghanistan' },
  { iso: 'AX', dial: '358', nameTr: 'Åland Adaları', nameEn: 'Åland Islands' },
  { iso: 'AL', dial: '355', nameTr: 'Arnavutluk', nameEn: 'Albania' },
  { iso: 'DZ', dial: '213', nameTr: 'Cezayir', nameEn: 'Algeria' },
  { iso: 'AS', dial: '1684', nameTr: 'Amerikan Samoası', nameEn: 'American Samoa' },
  { iso: 'AD', dial: '376', nameTr: 'Andorra', nameEn: 'Andorra' },
  { iso: 'AO', dial: '244', nameTr: 'Angola', nameEn: 'Angola' },
  { iso: 'AI', dial: '1264', nameTr: 'Anguilla', nameEn: 'Anguilla' },
  { iso: 'AG', dial: '1268', nameTr: 'Antigua ve Barbuda', nameEn: 'Antigua and Barbuda' },
  { iso: 'AR', dial: '54', nameTr: 'Arjantin', nameEn: 'Argentina' },
  { iso: 'AM', dial: '374', nameTr: 'Ermenistan', nameEn: 'Armenia' },
  { iso: 'AW', dial: '297', nameTr: 'Aruba', nameEn: 'Aruba' },
  { iso: 'AU', dial: '61', nameTr: 'Avustralya', nameEn: 'Australia' },
  { iso: 'AT', dial: '43', nameTr: 'Avusturya', nameEn: 'Austria' },
  { iso: 'AZ', dial: '994', nameTr: 'Azerbaycan', nameEn: 'Azerbaijan' },
  { iso: 'BS', dial: '1242', nameTr: 'Bahamalar', nameEn: 'Bahamas' },
  { iso: 'BH', dial: '973', nameTr: 'Bahreyn', nameEn: 'Bahrain' },
  { iso: 'BD', dial: '880', nameTr: 'Bangladeş', nameEn: 'Bangladesh' },
  { iso: 'BB', dial: '1246', nameTr: 'Barbados', nameEn: 'Barbados' },
  { iso: 'BY', dial: '375', nameTr: 'Belarus', nameEn: 'Belarus' },
  { iso: 'BE', dial: '32', nameTr: 'Belçika', nameEn: 'Belgium' },
  { iso: 'BZ', dial: '501', nameTr: 'Belize', nameEn: 'Belize' },
  { iso: 'BJ', dial: '229', nameTr: 'Benin', nameEn: 'Benin' },
  { iso: 'BM', dial: '1441', nameTr: 'Bermuda', nameEn: 'Bermuda' },
  { iso: 'BT', dial: '975', nameTr: 'Butan', nameEn: 'Bhutan' },
  { iso: 'BO', dial: '591', nameTr: 'Bolivya', nameEn: 'Bolivia' },
  { iso: 'BA', dial: '387', nameTr: 'Bosna-Hersek', nameEn: 'Bosnia and Herzegovina' },
  { iso: 'BW', dial: '267', nameTr: 'Botsvana', nameEn: 'Botswana' },
  { iso: 'BR', dial: '55', nameTr: 'Brezilya', nameEn: 'Brazil' },
  { iso: 'IO', dial: '246', nameTr: 'Britanya Hint Okyanusu Toprakları', nameEn: 'British Indian Ocean Territory' },
  { iso: 'VG', dial: '1284', nameTr: 'Britanya Virjin Adaları', nameEn: 'British Virgin Islands' },
  { iso: 'BN', dial: '673', nameTr: 'Brunei', nameEn: 'Brunei' },
  { iso: 'BG', dial: '359', nameTr: 'Bulgaristan', nameEn: 'Bulgaria' },
  { iso: 'BF', dial: '226', nameTr: 'Burkina Faso', nameEn: 'Burkina Faso' },
  { iso: 'BI', dial: '257', nameTr: 'Burundi', nameEn: 'Burundi' },
  { iso: 'KH', dial: '855', nameTr: 'Kamboçya', nameEn: 'Cambodia' },
  { iso: 'CM', dial: '237', nameTr: 'Kamerun', nameEn: 'Cameroon' },
  { iso: 'CA', dial: '1', nameTr: 'Kanada', nameEn: 'Canada' },
  { iso: 'CV', dial: '238', nameTr: 'Yeşil Burun Adaları', nameEn: 'Cape Verde' },
  { iso: 'KY', dial: '1345', nameTr: 'Cayman Adaları', nameEn: 'Cayman Islands' },
  { iso: 'CF', dial: '236', nameTr: 'Orta Afrika Cumhuriyeti', nameEn: 'Central African Republic' },
  { iso: 'TD', dial: '235', nameTr: 'Çad', nameEn: 'Chad' },
  { iso: 'CL', dial: '56', nameTr: 'Şili', nameEn: 'Chile' },
  { iso: 'CN', dial: '86', nameTr: 'Çin', nameEn: 'China' },
  { iso: 'CX', dial: '61', nameTr: 'Christmas Adası', nameEn: 'Christmas Island' },
  { iso: 'CC', dial: '61', nameTr: 'Cocos Adaları', nameEn: 'Cocos Islands' },
  { iso: 'CO', dial: '57', nameTr: 'Kolombiya', nameEn: 'Colombia' },
  { iso: 'KM', dial: '269', nameTr: 'Komorlar', nameEn: 'Comoros' },
  { iso: 'CG', dial: '242', nameTr: 'Kongo', nameEn: 'Congo' },
  { iso: 'CD', dial: '243', nameTr: 'Kongo Demokratik Cumhuriyeti', nameEn: 'Congo (DRC)' },
  { iso: 'CK', dial: '682', nameTr: 'Cook Adaları', nameEn: 'Cook Islands' },
  { iso: 'CR', dial: '506', nameTr: 'Kosta Rika', nameEn: 'Costa Rica' },
  { iso: 'CI', dial: '225', nameTr: 'Fildişi Sahili', nameEn: 'Côte d\'Ivoire' },
  { iso: 'HR', dial: '385', nameTr: 'Hırvatistan', nameEn: 'Croatia' },
  { iso: 'CU', dial: '53', nameTr: 'Küba', nameEn: 'Cuba' },
  { iso: 'CW', dial: '599', nameTr: 'Curaçao', nameEn: 'Curaçao' },
  { iso: 'CY', dial: '357', nameTr: 'Kıbrıs', nameEn: 'Cyprus' },
  { iso: 'CZ', dial: '420', nameTr: 'Çekya', nameEn: 'Czechia' },
  { iso: 'DK', dial: '45', nameTr: 'Danimarka', nameEn: 'Denmark' },
  { iso: 'DJ', dial: '253', nameTr: 'Cibuti', nameEn: 'Djibouti' },
  { iso: 'DM', dial: '1767', nameTr: 'Dominika', nameEn: 'Dominica' },
  { iso: 'DO', dial: '1809', nameTr: 'Dominik Cumhuriyeti', nameEn: 'Dominican Republic' },
  { iso: 'EC', dial: '593', nameTr: 'Ekvador', nameEn: 'Ecuador' },
  { iso: 'EG', dial: '20', nameTr: 'Mısır', nameEn: 'Egypt' },
  { iso: 'SV', dial: '503', nameTr: 'El Salvador', nameEn: 'El Salvador' },
  { iso: 'GQ', dial: '240', nameTr: 'Ekvator Ginesi', nameEn: 'Equatorial Guinea' },
  { iso: 'ER', dial: '291', nameTr: 'Eritre', nameEn: 'Eritrea' },
  { iso: 'EE', dial: '372', nameTr: 'Estonya', nameEn: 'Estonia' },
  { iso: 'SZ', dial: '268', nameTr: 'Esvatini', nameEn: 'Eswatini' },
  { iso: 'ET', dial: '251', nameTr: 'Etiyopya', nameEn: 'Ethiopia' },
  { iso: 'FK', dial: '500', nameTr: 'Falkland Adaları', nameEn: 'Falkland Islands' },
  { iso: 'FO', dial: '298', nameTr: 'Faroe Adaları', nameEn: 'Faroe Islands' },
  { iso: 'FJ', dial: '679', nameTr: 'Fiji', nameEn: 'Fiji' },
  { iso: 'FI', dial: '358', nameTr: 'Finlandiya', nameEn: 'Finland' },
  { iso: 'FR', dial: '33', nameTr: 'Fransa', nameEn: 'France' },
  { iso: 'GF', dial: '594', nameTr: 'Fransız Guyanası', nameEn: 'French Guiana' },
  { iso: 'PF', dial: '689', nameTr: 'Fransız Polinezyası', nameEn: 'French Polynesia' },
  { iso: 'GA', dial: '241', nameTr: 'Gabon', nameEn: 'Gabon' },
  { iso: 'GM', dial: '220', nameTr: 'Gambiya', nameEn: 'Gambia' },
  { iso: 'GE', dial: '995', nameTr: 'Gürcistan', nameEn: 'Georgia' },
  { iso: 'DE', dial: '49', nameTr: 'Almanya', nameEn: 'Germany' },
  { iso: 'GH', dial: '233', nameTr: 'Gana', nameEn: 'Ghana' },
  { iso: 'GI', dial: '350', nameTr: 'Cebelitarık', nameEn: 'Gibraltar' },
  { iso: 'GR', dial: '30', nameTr: 'Yunanistan', nameEn: 'Greece' },
  { iso: 'GL', dial: '299', nameTr: 'Grönland', nameEn: 'Greenland' },
  { iso: 'GD', dial: '1473', nameTr: 'Grenada', nameEn: 'Grenada' },
  { iso: 'GP', dial: '590', nameTr: 'Guadeloupe', nameEn: 'Guadeloupe' },
  { iso: 'GU', dial: '1671', nameTr: 'Guam', nameEn: 'Guam' },
  { iso: 'GT', dial: '502', nameTr: 'Guatemala', nameEn: 'Guatemala' },
  { iso: 'GG', dial: '44', nameTr: 'Guernsey', nameEn: 'Guernsey' },
  { iso: 'GN', dial: '224', nameTr: 'Gine', nameEn: 'Guinea' },
  { iso: 'GW', dial: '245', nameTr: 'Gine-Bissau', nameEn: 'Guinea-Bissau' },
  { iso: 'GY', dial: '592', nameTr: 'Guyana', nameEn: 'Guyana' },
  { iso: 'HT', dial: '509', nameTr: 'Haiti', nameEn: 'Haiti' },
  { iso: 'HN', dial: '504', nameTr: 'Honduras', nameEn: 'Honduras' },
  { iso: 'HK', dial: '852', nameTr: 'Hong Kong', nameEn: 'Hong Kong' },
  { iso: 'HU', dial: '36', nameTr: 'Macaristan', nameEn: 'Hungary' },
  { iso: 'IS', dial: '354', nameTr: 'İzlanda', nameEn: 'Iceland' },
  { iso: 'IN', dial: '91', nameTr: 'Hindistan', nameEn: 'India' },
  { iso: 'ID', dial: '62', nameTr: 'Endonezya', nameEn: 'Indonesia' },
  { iso: 'IR', dial: '98', nameTr: 'İran', nameEn: 'Iran' },
  { iso: 'IQ', dial: '964', nameTr: 'Irak', nameEn: 'Iraq' },
  { iso: 'IE', dial: '353', nameTr: 'İrlanda', nameEn: 'Ireland' },
  { iso: 'IM', dial: '44', nameTr: 'Man Adası', nameEn: 'Isle of Man' },
  { iso: 'IL', dial: '972', nameTr: 'İsrail', nameEn: 'Israel' },
  { iso: 'IT', dial: '39', nameTr: 'İtalya', nameEn: 'Italy' },
  { iso: 'JM', dial: '1876', nameTr: 'Jamaika', nameEn: 'Jamaica' },
  { iso: 'JP', dial: '81', nameTr: 'Japonya', nameEn: 'Japan' },
  { iso: 'JE', dial: '44', nameTr: 'Jersey', nameEn: 'Jersey' },
  { iso: 'JO', dial: '962', nameTr: 'Ürdün', nameEn: 'Jordan' },
  { iso: 'KZ', dial: '7', nameTr: 'Kazakistan', nameEn: 'Kazakhstan' },
  { iso: 'KE', dial: '254', nameTr: 'Kenya', nameEn: 'Kenya' },
  { iso: 'KI', dial: '686', nameTr: 'Kiribati', nameEn: 'Kiribati' },
  { iso: 'XK', dial: '383', nameTr: 'Kosova', nameEn: 'Kosovo' },
  { iso: 'KW', dial: '965', nameTr: 'Kuveyt', nameEn: 'Kuwait' },
  { iso: 'KG', dial: '996', nameTr: 'Kırgızistan', nameEn: 'Kyrgyzstan' },
  { iso: 'LA', dial: '856', nameTr: 'Laos', nameEn: 'Laos' },
  { iso: 'LV', dial: '371', nameTr: 'Letonya', nameEn: 'Latvia' },
  { iso: 'LB', dial: '961', nameTr: 'Lübnan', nameEn: 'Lebanon' },
  { iso: 'LS', dial: '266', nameTr: 'Lesotho', nameEn: 'Lesotho' },
  { iso: 'LR', dial: '231', nameTr: 'Liberya', nameEn: 'Liberia' },
  { iso: 'LY', dial: '218', nameTr: 'Libya', nameEn: 'Libya' },
  { iso: 'LI', dial: '423', nameTr: 'Liechtenstein', nameEn: 'Liechtenstein' },
  { iso: 'LT', dial: '370', nameTr: 'Litvanya', nameEn: 'Lithuania' },
  { iso: 'LU', dial: '352', nameTr: 'Lüksemburg', nameEn: 'Luxembourg' },
  { iso: 'MO', dial: '853', nameTr: 'Makao', nameEn: 'Macao' },
  { iso: 'MG', dial: '261', nameTr: 'Madagaskar', nameEn: 'Madagascar' },
  { iso: 'MW', dial: '265', nameTr: 'Malavi', nameEn: 'Malawi' },
  { iso: 'MY', dial: '60', nameTr: 'Malezya', nameEn: 'Malaysia' },
  { iso: 'MV', dial: '960', nameTr: 'Maldivler', nameEn: 'Maldives' },
  { iso: 'ML', dial: '223', nameTr: 'Mali', nameEn: 'Mali' },
  { iso: 'MT', dial: '356', nameTr: 'Malta', nameEn: 'Malta' },
  { iso: 'MH', dial: '692', nameTr: 'Marshall Adaları', nameEn: 'Marshall Islands' },
  { iso: 'MQ', dial: '596', nameTr: 'Martinik', nameEn: 'Martinique' },
  { iso: 'MR', dial: '222', nameTr: 'Moritanya', nameEn: 'Mauritania' },
  { iso: 'MU', dial: '230', nameTr: 'Mauritius', nameEn: 'Mauritius' },
  { iso: 'YT', dial: '262', nameTr: 'Mayotte', nameEn: 'Mayotte' },
  { iso: 'MX', dial: '52', nameTr: 'Meksika', nameEn: 'Mexico' },
  { iso: 'FM', dial: '691', nameTr: 'Mikronezya', nameEn: 'Micronesia' },
  { iso: 'MD', dial: '373', nameTr: 'Moldova', nameEn: 'Moldova' },
  { iso: 'MC', dial: '377', nameTr: 'Monako', nameEn: 'Monaco' },
  { iso: 'MN', dial: '976', nameTr: 'Moğolistan', nameEn: 'Mongolia' },
  { iso: 'ME', dial: '382', nameTr: 'Karadağ', nameEn: 'Montenegro' },
  { iso: 'MS', dial: '1664', nameTr: 'Montserrat', nameEn: 'Montserrat' },
  { iso: 'MA', dial: '212', nameTr: 'Fas', nameEn: 'Morocco' },
  { iso: 'MZ', dial: '258', nameTr: 'Mozambik', nameEn: 'Mozambique' },
  { iso: 'MM', dial: '95', nameTr: 'Myanmar', nameEn: 'Myanmar' },
  { iso: 'NA', dial: '264', nameTr: 'Namibya', nameEn: 'Namibia' },
  { iso: 'NR', dial: '674', nameTr: 'Nauru', nameEn: 'Nauru' },
  { iso: 'NP', dial: '977', nameTr: 'Nepal', nameEn: 'Nepal' },
  { iso: 'NL', dial: '31', nameTr: 'Hollanda', nameEn: 'Netherlands' },
  { iso: 'NC', dial: '687', nameTr: 'Yeni Kaledonya', nameEn: 'New Caledonia' },
  { iso: 'NZ', dial: '64', nameTr: 'Yeni Zelanda', nameEn: 'New Zealand' },
  { iso: 'NI', dial: '505', nameTr: 'Nikaragua', nameEn: 'Nicaragua' },
  { iso: 'NE', dial: '227', nameTr: 'Nijer', nameEn: 'Niger' },
  { iso: 'NG', dial: '234', nameTr: 'Nijerya', nameEn: 'Nigeria' },
  { iso: 'NU', dial: '683', nameTr: 'Niue', nameEn: 'Niue' },
  { iso: 'NF', dial: '672', nameTr: 'Norfolk Adası', nameEn: 'Norfolk Island' },
  { iso: 'KP', dial: '850', nameTr: 'Kuzey Kore', nameEn: 'North Korea' },
  { iso: 'MK', dial: '389', nameTr: 'Kuzey Makedonya', nameEn: 'North Macedonia' },
  { iso: 'MP', dial: '1670', nameTr: 'Kuzey Mariana Adaları', nameEn: 'Northern Mariana Islands' },
  { iso: 'NO', dial: '47', nameTr: 'Norveç', nameEn: 'Norway' },
  { iso: 'OM', dial: '968', nameTr: 'Umman', nameEn: 'Oman' },
  { iso: 'PK', dial: '92', nameTr: 'Pakistan', nameEn: 'Pakistan' },
  { iso: 'PW', dial: '680', nameTr: 'Palau', nameEn: 'Palau' },
  { iso: 'PS', dial: '970', nameTr: 'Filistin', nameEn: 'Palestine' },
  { iso: 'PA', dial: '507', nameTr: 'Panama', nameEn: 'Panama' },
  { iso: 'PG', dial: '675', nameTr: 'Papua Yeni Gine', nameEn: 'Papua New Guinea' },
  { iso: 'PY', dial: '595', nameTr: 'Paraguay', nameEn: 'Paraguay' },
  { iso: 'PE', dial: '51', nameTr: 'Peru', nameEn: 'Peru' },
  { iso: 'PH', dial: '63', nameTr: 'Filipinler', nameEn: 'Philippines' },
  { iso: 'PL', dial: '48', nameTr: 'Polonya', nameEn: 'Poland' },
  { iso: 'PT', dial: '351', nameTr: 'Portekiz', nameEn: 'Portugal' },
  { iso: 'PR', dial: '1787', nameTr: 'Porto Riko', nameEn: 'Puerto Rico' },
  { iso: 'QA', dial: '974', nameTr: 'Katar', nameEn: 'Qatar' },
  { iso: 'RE', dial: '262', nameTr: 'Réunion', nameEn: 'Réunion' },
  { iso: 'RO', dial: '40', nameTr: 'Romanya', nameEn: 'Romania' },
  { iso: 'RU', dial: '7', nameTr: 'Rusya', nameEn: 'Russia' },
  { iso: 'RW', dial: '250', nameTr: 'Ruanda', nameEn: 'Rwanda' },
  { iso: 'BL', dial: '590', nameTr: 'Saint Barthélemy', nameEn: 'Saint Barthélemy' },
  { iso: 'SH', dial: '290', nameTr: 'Saint Helena', nameEn: 'Saint Helena' },
  { iso: 'KN', dial: '1869', nameTr: 'Saint Kitts ve Nevis', nameEn: 'Saint Kitts and Nevis' },
  { iso: 'LC', dial: '1758', nameTr: 'Saint Lucia', nameEn: 'Saint Lucia' },
  { iso: 'MF', dial: '590', nameTr: 'Saint Martin', nameEn: 'Saint Martin' },
  { iso: 'PM', dial: '508', nameTr: 'Saint Pierre ve Miquelon', nameEn: 'Saint Pierre and Miquelon' },
  { iso: 'VC', dial: '1784', nameTr: 'Saint Vincent ve Grenadinler', nameEn: 'Saint Vincent and the Grenadines' },
  { iso: 'WS', dial: '685', nameTr: 'Samoa', nameEn: 'Samoa' },
  { iso: 'SM', dial: '378', nameTr: 'San Marino', nameEn: 'San Marino' },
  { iso: 'ST', dial: '239', nameTr: 'São Tomé ve Príncipe', nameEn: 'São Tomé and Príncipe' },
  { iso: 'SA', dial: '966', nameTr: 'Suudi Arabistan', nameEn: 'Saudi Arabia' },
  { iso: 'SN', dial: '221', nameTr: 'Senegal', nameEn: 'Senegal' },
  { iso: 'RS', dial: '381', nameTr: 'Sırbistan', nameEn: 'Serbia' },
  { iso: 'SC', dial: '248', nameTr: 'Seyşeller', nameEn: 'Seychelles' },
  { iso: 'SL', dial: '232', nameTr: 'Sierra Leone', nameEn: 'Sierra Leone' },
  { iso: 'SG', dial: '65', nameTr: 'Singapur', nameEn: 'Singapore' },
  { iso: 'SX', dial: '1721', nameTr: 'Sint Maarten', nameEn: 'Sint Maarten' },
  { iso: 'SK', dial: '421', nameTr: 'Slovakya', nameEn: 'Slovakia' },
  { iso: 'SI', dial: '386', nameTr: 'Slovenya', nameEn: 'Slovenia' },
  { iso: 'SB', dial: '677', nameTr: 'Solomon Adaları', nameEn: 'Solomon Islands' },
  { iso: 'SO', dial: '252', nameTr: 'Somali', nameEn: 'Somalia' },
  { iso: 'ZA', dial: '27', nameTr: 'Güney Afrika', nameEn: 'South Africa' },
  { iso: 'KR', dial: '82', nameTr: 'Güney Kore', nameEn: 'South Korea' },
  { iso: 'SS', dial: '211', nameTr: 'Güney Sudan', nameEn: 'South Sudan' },
  { iso: 'ES', dial: '34', nameTr: 'İspanya', nameEn: 'Spain' },
  { iso: 'LK', dial: '94', nameTr: 'Sri Lanka', nameEn: 'Sri Lanka' },
  { iso: 'SD', dial: '249', nameTr: 'Sudan', nameEn: 'Sudan' },
  { iso: 'SR', dial: '597', nameTr: 'Surinam', nameEn: 'Suriname' },
  { iso: 'SE', dial: '46', nameTr: 'İsveç', nameEn: 'Sweden' },
  { iso: 'CH', dial: '41', nameTr: 'İsviçre', nameEn: 'Switzerland' },
  { iso: 'SY', dial: '963', nameTr: 'Suriye', nameEn: 'Syria' },
  { iso: 'TW', dial: '886', nameTr: 'Tayvan', nameEn: 'Taiwan' },
  { iso: 'TJ', dial: '992', nameTr: 'Tacikistan', nameEn: 'Tajikistan' },
  { iso: 'TZ', dial: '255', nameTr: 'Tanzanya', nameEn: 'Tanzania' },
  { iso: 'TH', dial: '66', nameTr: 'Tayland', nameEn: 'Thailand' },
  { iso: 'TL', dial: '670', nameTr: 'Doğu Timor', nameEn: 'Timor-Leste' },
  { iso: 'TG', dial: '228', nameTr: 'Togo', nameEn: 'Togo' },
  { iso: 'TK', dial: '690', nameTr: 'Tokelau', nameEn: 'Tokelau' },
  { iso: 'TO', dial: '676', nameTr: 'Tonga', nameEn: 'Tonga' },
  { iso: 'TT', dial: '1868', nameTr: 'Trinidad ve Tobago', nameEn: 'Trinidad and Tobago' },
  { iso: 'TN', dial: '216', nameTr: 'Tunus', nameEn: 'Tunisia' },
  { iso: 'TR', dial: '90', nameTr: 'Türkiye', nameEn: 'Turkey' },
  { iso: 'TM', dial: '993', nameTr: 'Türkmenistan', nameEn: 'Turkmenistan' },
  { iso: 'TC', dial: '1649', nameTr: 'Turks ve Caicos Adaları', nameEn: 'Turks and Caicos Islands' },
  { iso: 'TV', dial: '688', nameTr: 'Tuvalu', nameEn: 'Tuvalu' },
  { iso: 'UG', dial: '256', nameTr: 'Uganda', nameEn: 'Uganda' },
  { iso: 'UA', dial: '380', nameTr: 'Ukrayna', nameEn: 'Ukraine' },
  { iso: 'AE', dial: '971', nameTr: 'Birleşik Arap Emirlikleri', nameEn: 'United Arab Emirates' },
  { iso: 'GB', dial: '44', nameTr: 'Birleşik Krallık', nameEn: 'United Kingdom' },
  { iso: 'US', dial: '1', nameTr: 'Amerika Birleşik Devletleri', nameEn: 'United States' },
  { iso: 'UY', dial: '598', nameTr: 'Uruguay', nameEn: 'Uruguay' },
  { iso: 'VI', dial: '1340', nameTr: 'ABD Virjin Adaları', nameEn: 'U.S. Virgin Islands' },
  { iso: 'UZ', dial: '998', nameTr: 'Özbekistan', nameEn: 'Uzbekistan' },
  { iso: 'VU', dial: '678', nameTr: 'Vanuatu', nameEn: 'Vanuatu' },
  { iso: 'VA', dial: '379', nameTr: 'Vatikan', nameEn: 'Vatican City' },
  { iso: 'VE', dial: '58', nameTr: 'Venezuela', nameEn: 'Venezuela' },
  { iso: 'VN', dial: '84', nameTr: 'Vietnam', nameEn: 'Vietnam' },
  { iso: 'WF', dial: '681', nameTr: 'Wallis ve Futuna', nameEn: 'Wallis and Futuna' },
  { iso: 'YE', dial: '967', nameTr: 'Yemen', nameEn: 'Yemen' },
  { iso: 'ZM', dial: '260', nameTr: 'Zambiya', nameEn: 'Zambia' },
  { iso: 'ZW', dial: '263', nameTr: 'Zimbabve', nameEn: 'Zimbabwe' },
]

export function getCountryCallingCode(iso: string | null | undefined): CountryCallingCode {
  const found = COUNTRY_CALLING_CODES.find(item => item.iso === iso)
  return found ?? COUNTRY_CALLING_CODES.find(item => item.iso === DEFAULT_PHONE_COUNTRY_ISO)!
}

function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

function looksLikeTurkishMobile(digits: string): boolean {
  if (digits.length === 10 && digits.startsWith('5')) return true
  if (digits.length === 11 && digits.startsWith('05')) return true
  if (digits.length === 12 && digits.startsWith('905')) return true
  return false
}

export function splitCitizenPhone(value: string | null | undefined): { iso: string; national: string; dial: string } {
  const digits = digitsOnly(value)
  if (!digits) {
    const tr = getCountryCallingCode('TR')
    return { iso: tr.iso, national: '', dial: tr.dial }
  }
  if (looksLikeTurkishMobile(digits)) {
    const national = digits.startsWith('90') ? digits.slice(2)
      : digits.startsWith('0') ? digits.slice(1)
      : digits
    return { iso: 'TR', national, dial: '90' }
  }
  const ranked = [...COUNTRY_CALLING_CODES].sort((a, b) => b.dial.length - a.dial.length || a.iso.localeCompare(b.iso))
  for (const country of ranked) {
    if (digits.startsWith(country.dial) && digits.length > country.dial.length + 3) {
      return { iso: country.iso, national: digits.slice(country.dial.length), dial: country.dial }
    }
  }
  return { iso: 'TR', national: digits, dial: '90' }
}

export function composeStoredCitizenPhone(iso: string, nationalDigits: string): string {
  const national = digitsOnly(nationalDigits)
  const country = getCountryCallingCode(iso)
  if (country.iso === 'TR') return national
  return `${country.dial}${national}`
}

export function sanitizeForeignNationalInput(next: string, dial: string, maxLength = 15): string {
  let digits = next.replace(/\D/g, '')
  if (digits.startsWith(`00${dial}`)) digits = digits.slice(2 + dial.length)
  else if (digits.startsWith(dial) && digits.length > dial.length + 3) digits = digits.slice(dial.length)
  return digits.slice(0, maxLength)
}

export function formatNationalPhoneGroups(national: string): string {
  const digits = digitsOnly(national)
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`
  }
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim()
}

