#include <iostream>
#include <map>
#include <string>

using namespace std;

int main() {
    map<int, int> m;
    m[1] = 2;
    m[10] = 20;

    int k = 1;
    cout << m.count(k) << endl; // 1
    cout << m.count(5) << endl; // 0

    return 0;
}
