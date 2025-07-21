export type CodebookVariable = {
  id: string;
  label: string;
  description: string;
  values?: { value: string; label: string }[];
};

export const codebook: CodebookVariable[] = [
  {
    id: 'cntry',
    label: 'Country',
    description: 'Country',
    values: [
      { value: 'AT', label: 'Austria' },
      { value: 'BE', label: 'Belgium' },
      { value: 'CH', label: 'Switzerland' },
      { value: 'CZ', label: 'Czechia' },
      { value: 'DE', label: 'Germany' },
      { value: 'DK', label: 'Denmark' },
      { value: 'ES', label: 'Spain' },
      { value: 'FI', label: 'Finland' },
      { value: 'FR', label: 'France' },
      { value: 'GB', label: 'United Kingdom' },
      { value: 'GR', label: 'Greece' },
      { value: 'HU', label: 'Hungary' },
      { value: 'IE', label: 'Ireland' },
      { value: 'IL', label: 'Israel' },
      { value: 'IT', label: 'Italy' },
      { value: 'LU', label: 'Luxembourg' },
      { value: 'NL', label: 'Netherlands' },
      { value: 'NO', label: 'Norway' },
      { value: 'PL', label: 'Poland' },
      { value: 'PT', label: 'Portugal' },
      { value: 'SE', label: 'Sweden' },
      { value: 'SI', label: 'Slovenia' },
    ],
  },
  {
    id: 'tvtot',
    label: 'TV watching, total time on average weekday',
    description: 'On an average weekday, how much time, in total, do you spend watching television?',
    values: [
      { value: '0', label: 'No time at all' },
      { value: '1', label: 'Less than 0,5 hour' },
      { value: '2', label: '0,5 hour to 1 hour' },
      { value: '3', label: 'More than 1 hour, up to 1,5 hours' },
      { value: '4', label: 'More than 1,5 hours, up to 2 hours' },
      { value: '5', label: 'More than 2 hours, up to 2,5 hours' },
      { value: '6', label: 'More than 2,5 hours, up to 3 hours' },
      { value: '7', label: 'More than 3 hours' },
    ],
  },
  {
    id: 'ppltrst',
    label: 'Most people can be trusted or you can\'t be too careful',
    description: 'Generally speaking, would you say that most people can be trusted, or that you can\'t be too careful in dealing with people? 0 means you can\'t be too careful and 10 means that most people can be trusted.',
    values: [
      { value: '0', label: 'You can\'t be too careful' },
      { value: '10', label: 'Most people can be trusted' },
    ],
  },
  {
    id: 'polintr',
    label: 'How interested in politics',
    description: 'How interested would you say you are in politics?',
    values: [
      { value: '1', label: 'Very interested' },
      { value: '2', label: 'Quite interested' },
      { value: '3', label: 'Hardly interested' },
      { value: '4', label: 'Not at all interested' },
    ],
  },
  {
    id: 'trstlgl',
    label: 'Trust in the legal system',
    description: 'On a score of 0-10 how much you personally trust the legal system. 0 means you do not trust an institution at all, and 10 means you have complete trust.',
  },
  {
    id: 'trstplc',
    label: 'Trust in the police',
    description: 'On a score of 0-10 how much you personally trust the police. 0 means you do not trust an institution at all, and 10 means you have complete trust.',
  },
  {
    id: 'trstplt',
    label: 'Trust in politicians',
    description: 'On a score of 0-10 how much you personally trust politicians. 0 means you do not trust an institution at all, and 10 means you have complete trust.',
  },
  {
    id: 'trstprl',
    label: 'Trust in country\'s parliament',
    description: 'On a score of 0-10 how much you personally trust the country\'s parliament. 0 means you do not trust an institution at all, and 10 means you have complete trust.',
  },
  {
    id: 'vote',
    label: 'Voted last national election',
    description: 'Did you vote in the last national election?',
    values: [
      { value: '1', label: 'Yes' },
      { value: '2', label: 'No' },
      { value: '3', label: 'Not eligible to vote' },
    ],
  },
  {
    id: 'stflife',
    label: 'How satisfied with life as a whole',
    description: 'All things considered, how satisfied are you with your life as a whole nowadays? 0 means extremely dissatisfied and 10 means extremely satisfied.',
  },
  {
    id: 'stfeco',
    label: 'How satisfied with present state of economy in country',
    description: 'On the whole how satisfied are you with the present state of the economy in the country? 0 means extremely dissatisfied and 10 means extremely satisfied.',
  },
  {
    id: 'happy',
    label: 'How happy are you',
    description: 'Taking all things together, how happy would you say you are? 0 means extremely unhappy and 10 means extremely happy.',
  },
  {
    id: 'health',
    label: 'Subjective general health',
    description: 'How is your health in general?',
    values: [
      { value: '1', label: 'Very good' },
      { value: '2', label: 'Good' },
      { value: '3', label: 'Fair' },
      { value: '4', label: 'Bad' },
      { value: '5', label: 'Very bad' },
    ],
  },
  {
    id: 'gndr',
    label: 'Gender',
    description: 'Gender of respondent.',
    values: [
      { value: '1', label: 'Male' },
      { value: '2', label: 'Female' },
    ],
  },
  {
    id: 'agea',
    label: 'Age of respondent, calculated',
    description: 'Age of respondent.',
  },
  {
    id: 'eduyrs',
    label: 'Years of full-time education completed',
    description: 'How many years of education have you completed, whether full-time or part-time?',
  },
  {
    id: 'hinctnt',
    label: 'Household\'s total net income, all sources',
    description: 'Household\'s total net income. Uses categories J, R, C, M, F, S, K, P, D, H, U, N, which likely correspond to income brackets.',
  },
  {
    id: 'region',
    label: 'Region',
    description: 'Region of the respondent within the country.',
  },
];

export const getCodebookAsString = () => {
    return codebook.map(v => `Variable: ${v.id} (${v.label}): ${v.description}`).join('\n');
}
