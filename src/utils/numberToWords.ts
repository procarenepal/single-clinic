export function numberToWords(num: number): string {
  if (num === 0) return "Zero";

  const a = [
    "",
    "One ",
    "Two ",
    "Three ",
    "Four ",
    "Five ",
    "Six ",
    "Seven ",
    "Eight ",
    "Nine ",
    "Ten ",
    "Eleven ",
    "Twelve ",
    "Thirteen ",
    "Fourteen ",
    "Fifteen ",
    "Sixteen ",
    "Seventeen ",
    "Eighteen ",
    "Nineteen ",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const inWords = (n: number): string => {
    let str = "";
    if (n > 99) {
      str += a[Math.floor(n / 100)] + "Hundred ";
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      str += a[n];
    }
    return str;
  };

  let word = "";
  let n = Math.floor(num); // Handle integer part
  
  if (n > 9999999) {
    word += inWords(Math.floor(n / 10000000)) + "Crore ";
    n %= 10000000;
  }
  if (n > 99999) {
    word += inWords(Math.floor(n / 100000)) + "Lakh ";
    n %= 100000;
  }
  if (n > 999) {
    word += inWords(Math.floor(n / 1000)) + "Thousand ";
    n %= 1000;
  }
  word += inWords(n);

  return word.trim();
}
