#include <algorithm>
#include <vector>
#include <cstdio>

int main() {
  const int A[] = {2,  3,  5,  7,  11, 13, 17, 19, 23, 29, 31, 37, 41,
               43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97};
  std::vector<int> vec;
  for (auto i : A) {
    vec.push_back(i);
  }
  auto it = vec.begin();
  auto end = vec.end();
  while (it != end) {
    if (*it % 3 == 1) {
        //it = vec.erase(it);
        end = std::remove(vec.begin(), end, *it);
    } else {
        it++;
    }
  }
  for (auto i : vec) {
    printf("%d ", i);
  }
  printf("\n");
}
