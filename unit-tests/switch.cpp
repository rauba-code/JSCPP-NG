int main() {
  //           "523 52    323"
  char str[] = "vaisvandeniai";
  int a = 1;
  for (char *c = str; *c != '\0'; c++) {
      switch (*c) {
          case 'i':
            a *= 10;
            a += 3;
          break;
          case 'a':
            a *= 10;
            a += 2;
          break;
          case 'v':
            a *= 10;
            a += 5;
          break;
      }
  }
  return a;
}
