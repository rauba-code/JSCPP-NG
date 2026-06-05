#include <iostream>
#include <map>
#include <string>

using namespace std;

int main() {
    map<int, int> m;
    m[1] = 2;
    m[10] = 20;

    if (m.contains(10)) {
        cout << "contains 10" << endl;
    }
    if (!m.contains(100)) {
        cout << "not contains 100" << endl;
    }

    return 0;
}
