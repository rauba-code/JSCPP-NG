#include <iostream>
#include <cstdlib>

using namespace std;

int main() {
    long long int boo = 117964236720838;
    cout << boo << endl;
    boo++;
    cout << boo << endl;
    long long int c;
    cin >> c;
    boo -= c;
    cout << boo << endl;
    boo = llabs(boo);
    cout << boo << endl;
    boo %= 1000000003;
    cout << boo << endl;
    boo *= boo;
    cout << boo << endl;
    boo *= boo;
    cout << boo << endl;
    return 0;
}
