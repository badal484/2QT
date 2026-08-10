#include <string>
#include <vector>
#include <memory>

namespace facebook {
namespace react {

struct DebugStringConvertibleOptions {
  bool format{true};
};

class DebugStringConvertible;

class Sealable {
public:
    Sealable();
    ~Sealable(); // NON-VIRTUAL destructor (Itanium D2Ev) - no vtable injection!
    void ensureUnsealed() const;
};

Sealable::Sealable() {}
Sealable::~Sealable() {}
void Sealable::ensureUnsealed() const {}

class ShadowNode {
public:
    std::string getDebugName() const;
    std::string getDebugValue() const;
    std::vector<std::shared_ptr<DebugStringConvertible>> getDebugChildren() const;
};

std::string ShadowNode::getDebugName() const { return ""; }
std::string ShadowNode::getDebugValue() const { return ""; }
std::vector<std::shared_ptr<DebugStringConvertible>> ShadowNode::getDebugChildren() const { return {}; }

}
}
