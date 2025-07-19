export type CodebookVariable = {
  id: string;
  label: string;
  description: string;
  values?: { value: string; label: string }[];
};

export const codebook: CodebookVariable[] = [
  {
    id: "essround",
    label: "ESS round",
    description: "The round of the European Social Survey.",
  },
  {
    id: "idno",
    label: "Respondent's identification number",
    description: "A unique number to identify each respondent.",
  },
  {
    id: "cntry",
    label: "Country",
    description: "Country of residence.",
    values: [
      { value: "AT", label: "Austria" },
      { value: "BE", label: "Belgium" },
      { value: "BG", label: "Bulgaria" },
      { value: "CH", label: "Switzerland" },
    ],
  },
  {
    id: "gndr",
    label: "Gender",
    description: "Gender of the respondent.",
    values: [
      { value: "1", label: "Male" },
      { value: "2", label: "Female" },
    ],
  },
  {
    id: "agea",
    label: "Age of respondent, calculated",
    description: "The calculated age of the respondent.",
  },
  {
    id: "trstprl",
    label: "Trust in the parliament",
    description: "On a scale from 0-10, how much do you personally trust the parliament.",
    values: [
        { value: "0", label: "No trust at all" },
        { value: "10", label: "Complete trust" },
    ]
  },
  {
    id: "ppltrst",
    label: "Most people can be trusted or you can't be too careful",
    description: "Generally speaking, would you say that most people can be trusted, or that you can't be too careful in dealing with people?",
     values: [
        { value: "0", label: "You can't be too careful" },
        { value: "10", label: "Most people can be trusted" },
    ]
  },
  {
    id: "polintr",
    label: "How interested in politics",
    description: "How interested are you in politics?",
    values: [
        { value: "1", label: "Very interested" },
        { value: "2", label: "Quite interested" },
        { value: "3", label: "Hardly interested" },
        { value: "4", label: "Not at all interested" },
    ]
  }
];

export const getCodebookAsString = () => {
    return codebook.map(v => `Variable: ${v.id} (${v.label}): ${v.description}`).join('\n');
}
