#include <iostream>
#include <utility>
#include <algorithm>
#include <string>

using namespace std;

int main() {
    int a=1,b=2;
    swap(a,b);
    cout << a << ',' << b << endl;
    
    string s1="hello", s2="world";
    swap(s1, s2);
    cout << s1 << ',' << s2 << endl;
    
    return 0;
}
