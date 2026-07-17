# Nhật ký thay đổi

## [2.2.0] - July 2026

**Tóm tắt:** Tích hợp bảng tạm hệ thống với các ứng dụng khác, chọn bằng khung kéo, chế độ xem chia đôi liên kết, xử lý liên kết, tệp ZIP có mật khẩu, cửa sổ Thuộc tính gốc của Windows, mở rộng API tiện ích, hỗ trợ tiếng Do Thái và cải thiện trình điều hướng.

- [Tính năng mới](#tính-năng-mới)
  - [Tích hợp bảng tạm hệ thống](#tích-hợp-bảng-tạm-hệ-thống)
  - [Chọn bằng khung kéo](#chọn-bằng-khung-kéo)
  - [Chế độ xem chia đôi liên kết](#chế-độ-xem-chia-đôi-liên-kết)
  - [Xử lý liên kết](#xử-lý-liên-kết)
  - [Cửa sổ Thuộc tính gốc](#cửa-sổ-thuộc-tính-gốc)
  - [Thay đổi kích thước và sắp xếp cột chế độ xem danh sách](#thay-đổi-kích-thước-và-sắp-xếp-cột-chế-độ-xem-danh-sách)
  - [Vị trí ở cấp gốc](#vị-trí-ở-cấp-gốc)
- [Tiện ích mở rộng](#tiện-ích-mở-rộng)
  - [API và chế độ xem tiện ích](#api-và-chế-độ-xem-tiện-ích)
- [Cài đặt mới](#cài-đặt-mới)
- [Phím tắt mới](#phím-tắt-mới)
- [Ngôn ngữ mới](#ngôn-ngữ-mới)
- [Cải thiện trải nghiệm người dùng](#cải-thiện-trải-nghiệm-người-dùng)
  - [Giải nén tệp lưu trữ](#giải-nén-tệp-lưu-trữ)
  - [Sắp xếp lưới](#sắp-xếp-lưới)
  - [Tiện ích Shell](#tiện-ích-shell)
  - [Bộ nhớ phiên](#bộ-nhớ-phiên)
  - [Hiệu năng trình điều hướng](#hiệu-năng-trình-điều-hướng)
  - [Trang chủ và menu ngữ cảnh](#trang-chủ-và-menu-ngữ-cảnh)
- [Cải thiện giao diện](#cải-thiện-giao-diện)
- [Sửa lỗi](#sửa-lỗi)

### Tính năng mới

#### Tích hợp bảng tạm hệ thống

Sao chép và dán tệp, thư mục và hình ảnh giữa Sigma File Manager và các ứng dụng khác qua bảng tạm hệ thống.

- **Chuyển tệp giữa các ứng dụng**: sao chép hoặc cắt mục trong SFM rồi dán vào ứng dụng như File Explorer, hoặc dùng `Ctrl+V` để dán đường dẫn và tệp đã sao chép từ ứng dụng khác vào trình điều hướng;
- **Dán hình ảnh**: dán hình ảnh đã sao chép từ trình duyệt và ứng dụng khác trực tiếp vào thư mục;
- **Hộp thoại xung đột**: khi mục cần dán đã tồn tại, chọn `Đổi tên` hoặc `Hợp nhất`; với từng tệp xung đột, có thể chọn `Thay thế`, `Bỏ qua`, `Giữ cả hai` hoặc `Áp dụng cho tất cả`;
- **Thanh công cụ bảng tạm**: tùy chọn xem trước hình ảnh và đường dẫn tệp được sao chép từ ứng dụng khác ngay trên thanh công cụ;

Có thể bật hoặc tắt thanh công cụ trong `Cài đặt > Giao diện > Bảng tạm`. Phím `Ctrl+V` vẫn hoạt động khi thanh công cụ bị ẩn.

![system-clipboard](./public/changelog/assets/2.2.0/system-clipboard.webp)

#### Chọn bằng khung kéo

Kéo trên vùng trống trong trình điều hướng để chọn nhiều mục bằng khung chọn.

- **Phím bổ trợ**: giữ `Ctrl` hoặc `Shift` để thêm mục vào vùng chọn hiện tại; giữ `Alt` để đảo ngược trạng thái chọn;
- **Dễ bắt đầu kéo hơn**: có thể tăng khoảng đệm của danh sách và khoảng cách trong lưới để tạo thêm vùng trống;

Bật trong `Cài đặt > Chung > Chế độ xem tệp > Bật chọn bằng khung kéo`.

![box-selection](./public/changelog/assets/2.2.0/box-selection.webp)

#### Chế độ xem chia đôi liên kết

Chế độ xem chia đôi `Liên kết` mới mang lại cách làm việc theo cột đơn giản hơn: khi nhấp vào một thư mục trong ngăn đầu tiên, nội dung của thư mục sẽ xuất hiện trong ngăn thứ hai.

Chế độ `Chia đôi` độc lập hiện có vẫn giữ nguyên. Chọn chế độ trong mục `Chế độ xem chia đôi` của menu tùy chọn trình điều hướng, hoặc bật và tắt chế độ xem chia đôi bằng `Ctrl+S`.

Biểu tượng bảng thông tin cũng được cập nhật để dễ phân biệt với biểu tượng chế độ xem chia đôi.

![linked-split-view](./public/changelog/assets/2.2.0/linked-split-view.webp)

#### Xử lý liên kết

Tạo và kiểm tra liên kết hệ thống tệp từ trình điều hướng.

- **Tạo liên kết**: tạo liên kết tượng trưng, lối tắt, liên kết cứng và điểm nối từ menu ngữ cảnh (`Tạo liên kết`);
- **Cột liên kết**: các cột danh sách tùy chọn gồm Loại, Liên kết, Đích liên kết và Trạng thái liên kết (`Hợp lệ`, `Hỏng`, `Không rõ`, `Không được hỗ trợ`);
- **Cách mở liên kết**: lối tắt thư mục và thư mục liên kết tượng trưng sẽ mở đích tương ứng; các đích liên kết khác được mở bằng ứng dụng mặc định;

![link-handling](./public/changelog/assets/2.2.0/link-handling.webp)

#### Cửa sổ Thuộc tính gốc

Trên Windows, có thể mở hộp thoại Thuộc tính gốc của hệ thống cho các mục đã chọn qua menu ngữ cảnh, menu thao tác, phím `Alt+Enter` hoặc bằng cách giữ `Alt` rồi nhấp đúp.

![native-properties](./public/changelog/assets/2.2.0/native-properties.webp)

#### Thay đổi kích thước và sắp xếp cột chế độ xem danh sách

Các cột chế độ xem danh sách có thể thay đổi kích thước và sắp xếp lại cho phù hợp cách bạn làm việc.

- **Đổi kích thước**: kéo cạnh cột để thay đổi chiều rộng;
- **Sắp xếp và hiển thị**: quản lý thứ tự và khả năng hiển thị trong cửa sổ bật lên `Cột` ở tiêu đề danh sách;
- **Tùy chọn chiều rộng**: `Lấp đầy chiều rộng còn trống` và `Đặt chiều rộng tối thiểu`;

![list-column-resize](./public/changelog/assets/2.2.0/list-column-resize.webp)

#### Vị trí ở cấp gốc

Mục `Vị trí` ở cấp gốc liệt kê các ổ đĩa và vị trí ảo để bạn chuyển đổi nhanh hơn.

- **Thanh địa chỉ**: đi lên một cấp từ thư mục gốc của ổ đĩa, hoặc mở `Vị trí` từ thanh địa chỉ hay trình chỉnh sửa địa chỉ;
- **Mục yêu thích và thẻ**: có thể thêm `Vị trí` vào mục yêu thích và gắn thẻ như các thư mục khác;
- **Chế độ xem chia đôi**: đặc biệt hữu ích khi chuyển ổ đĩa giữa các ngăn mà không cần rời trình điều hướng;

![root-locations-address](./public/changelog/assets/2.2.0/root-locations-address.webp)

### Tiện ích mở rộng

#### API và chế độ xem tiện ích

Tiện ích mở rộng có thêm nhiều khả năng từ ứng dụng chủ và các thành phần để xây dựng giao diện.

- **Tệp nhị phân cục bộ**: cấu hình phần phụ thuộc của tiện ích bằng thiết lập tự động hoặc tệp nhị phân cục bộ được chọn thủ công (`Tiện ích mở rộng > Phần phụ thuộc`);
- **Yêu cầu HTTP**: tiện ích có thể gửi yêu cầu HTTP đến các máy chủ được tệp khai báo cho phép;
- **Điều khiển chế độ xem**: tiện ích có quyền xem có thể áp dụng tùy chọn về bố cục và cách sắp xếp của trình điều hướng;
- **API bảng tạm**: tiện ích có quyền tương ứng có thể đọc và ghi bảng tạm;
- **Chế độ xem danh sách-chi tiết**: mẫu giao diện tiện ích mới gồm danh sách có thể tìm kiếm và ngăn chi tiết;

![extension-local-binaries](./public/changelog/assets/2.2.0/extension-local-binaries.webp)

![extension-dependency-config](./public/changelog/assets/2.2.0/extension-dependency-config.webp)

![extension-list-detail](./public/changelog/assets/2.2.0/extension-list-detail.webp)

![extension-http-api](./public/changelog/assets/2.2.0/extension-http-api.webp)

### Cài đặt mới

- **Bật chọn bằng khung kéo**: kéo vùng trống để chọn nhiều mục;
  `Cài đặt > Chung > Chế độ xem tệp > Bật chọn bằng khung kéo`
- **Tăng khoảng cách trong chế độ xem tệp**: tăng khoảng đệm của danh sách và khoảng cách trong lưới để dễ bắt đầu kéo hơn;
  `Cài đặt > Chung > Chế độ xem tệp > Tăng khoảng cách trong chế độ xem tệp`
- **Giữ cửa sổ Quick View trong bộ nhớ**: giữ Quick View đã tải để mở ngay (dùng khoảng 200 MB);
  `Cài đặt > Chung > Hiệu năng > Giữ cửa sổ Quick View trong bộ nhớ`
- **Giữ cửa sổ in trong bộ nhớ**: giữ cửa sổ In đã tải để mở ngay (dùng khoảng 200 MB);
  `Cài đặt > Chung > Hiệu năng > Giữ cửa sổ in trong bộ nhớ`
- **Thanh công cụ bảng tạm cho hình ảnh bên ngoài**: hiện thanh công cụ bảng tạm cho hình ảnh được sao chép từ ứng dụng khác;
  `Cài đặt > Giao diện > Bảng tạm`
- **Thanh công cụ bảng tạm cho đường dẫn bên ngoài**: hiện thanh công cụ bảng tạm cho đường dẫn tệp được sao chép từ ứng dụng khác;
  `Cài đặt > Giao diện > Bảng tạm`
- **Kích thước bảng thông tin động**: tự động điều chỉnh kích thước bảng thông tin; việc đổi kích thước thủ công sẽ tắt tùy chọn này;
  `Cài đặt > Giao diện > Bảng thông tin > Kích thước bảng thông tin động`
- **Hiển thị ảnh kích thước đầy đủ trong xem trước bảng thông tin**: hiện ảnh độ phân giải đầy đủ trong bảng thông tin;
  `Cài đặt > Giao diện > Bảng thông tin > Hiển thị ảnh kích thước đầy đủ trong khu vực xem trước bảng thông tin`
- **Tắt tiếng xem trước video theo mặc định**: tắt tiếng xem trước video bảng thông tin khi duyệt;
  `Cài đặt > Giao diện > Bảng thông tin > Tắt tiếng xem trước video theo mặc định`
- **Tự động phát xem trước video**: tự phát video trong bảng thông tin khi được chọn;
  `Cài đặt > Giao diện > Bảng thông tin > Tự động phát xem trước video`

### Phím tắt mới

- **Thuộc tính gốc** (`Alt+Enter`): mở cửa sổ Thuộc tính gốc của Windows cho các mục đã chọn;

### Ngôn ngữ mới

- **Tiếng Do Thái** (`עברית`): bản dịch đầy đủ, hỗ trợ bố cục từ phải sang trái (`Cài đặt > Chung > Ngôn ngữ`);

### Cải thiện trải nghiệm người dùng

#### Giải nén tệp lưu trữ

Tính năng giải nén ZIP hiện hỗ trợ tệp lưu trữ được mã hóa và tên tệp dùng bảng mã khác UTF-8.

- **ZIP có mật khẩu**: nhập mật khẩu của tệp lưu trữ khi được yêu cầu trong quá trình giải nén;
- **Bảng mã tên tệp**: chọn bảng mã trong `Tùy chọn giải nén tệp lưu trữ`; hệ thống ưu tiên tự động phát hiện và cung cấp các bảng mã được nhóm theo khu vực để dùng khi cần;

![archive-extraction-options](./public/changelog/assets/2.2.0/archive-extraction-options.webp)

![archive-extraction-encoding](./public/changelog/assets/2.2.0/archive-extraction-encoding.webp)

#### Sắp xếp lưới

Bố cục lưới giờ có điều khiển sắp xếp riêng trong menu tùy chọn trình điều hướng.

- **Sắp xếp theo**: Tên, Số mục, Kích thước, Ngày sửa đổi, Ngày tạo, Thẻ, Loại, Liên kết và Trạng thái liên kết;
- **Hướng**: tăng dần hoặc giảm dần, lưu riêng với sắp xếp chế độ xem danh sách;

![grid-sorting](./public/changelog/assets/2.2.0/grid-sorting.webp)

#### Tiện ích Shell

Menu ngữ cảnh có thể tải các thao tác tiện ích Shell hiện đại do ứng dụng khác đăng ký trong mục `Tiện ích Shell`.

![shell-extensions](./public/changelog/assets/2.2.0/shell-extensions.webp)

#### Bộ nhớ phiên

Vị trí cuộn và thẻ đang hoạt động được khôi phục khi bạn rời khỏi trang hoặc ngăn rồi quay lại trong cùng một phiên.

#### Hiệu năng trình điều hướng

Duyệt thư mục lớn và nội dung đa phương tiện nhanh hơn, đồng thời sử dụng ít bộ nhớ hơn.

- **Tải lần đầu**: tải lần đầu nhanh hơn khi mở thư mục;
- **Tải biểu tượng**: biểu tượng tùy chỉnh và biểu tượng hệ thống xuất hiện nhanh hơn;
- **Cuộn danh sách**: cuộn danh sách mượt hơn trong thư mục lớn;
- **Xem trước phương tiện**: xem trước hình ảnh, GIF và video phản hồi tốt hơn và dùng ít bộ nhớ hơn;
- **Lập chỉ mục**: lập chỉ mục tìm kiếm toàn cục ổn định hơn;

#### Trang chủ và menu ngữ cảnh

- **Ngắt kết nối**: ngắt kết nối ổ mạng hoặc thiết bị lưu trữ di động từ menu ngữ cảnh khi được hỗ trợ;
- **Đóng tất cả mục trùng lặp**: mục `Đóng tất cả mục trùng lặp` trong menu thẻ giờ đóng mọi đường dẫn trùng lặp trong không gian làm việc, thay vì chỉ các bản sao của thẻ hiện tại;
- **Bỏ chọn bằng nhấp phải**: nhấp phải vào vùng trống của trình điều hướng sẽ bỏ vùng chọn hiện tại trước khi mở menu nền;
- **Thao tác trên trang chủ**: menu ngữ cảnh của trang chủ đóng sau khi chọn thao tác; `Mở trong thẻ mới` sẽ mở trình điều hướng và tự cuộn thẻ mới vào vùng hiển thị;
- **Vùng kéo cửa sổ**: trên thanh tiêu đề kiểu Linux, vùng kéo kéo dài qua các nút thanh công cụ để dễ di chuyển cửa sổ hơn;

![window-drag-region](./public/changelog/assets/2.2.0/window-drag-region.webp)

### Cải thiện giao diện

- **Chỉ báo ngăn đang hoạt động**: chỉ báo ngăn đang hoạt động trên thanh trạng thái rõ ràng hơn khi bật chế độ xem chia đôi;
- **Bảng thông tin có thể đổi kích thước**: kéo để điều chỉnh chiều rộng bảng thông tin và tỷ lệ giữa phần xem trước với phần chi tiết;
- **Bảng thông tin gọn**: bố cục thuộc tính trong bảng thông tin gọn gàng và tiết kiệm diện tích hơn;
- **Thao tác menu ngữ cảnh**: `Chỉnh sửa thẻ` được hiển thị dưới dạng nút thao tác, đồng thời các nút thao tác có kích thước nhỏ hơn;
- **Giao diện trình điều hướng**: cải thiện bố cục thích ứng, kiểu thẻ đang hoạt động trong chế độ xem chia đôi và thiết kế chế độ xem tiện ích trong bảng lệnh;
- **Bố cục RTL**: căn chỉnh gọn gàng hơn cho các ngôn ngữ viết từ phải sang trái;

![resizable-info-panel](./public/changelog/assets/2.2.0/resizable-info-panel.webp)

![compact-info-panel](./public/changelog/assets/2.2.0/compact-info-panel.webp)

### Sửa lỗi

- **Gõ để tìm**: sửa tìm kiếm nhanh không kích hoạt trên bố cục bàn phím không Latin;
- **Tải thư mục**: sửa mục bị sắp xếp lại sau khi thư mục tải xong;
- **Biểu tượng tùy chỉnh**: sửa biểu tượng tùy chỉnh tải với độ trễ đáng chú ý;
- **Thẻ lưới**: sửa thẻ bố cục lưới đổi kích thước khi đang tải;
- **Thanh cuộn lưới**: sửa thanh cuộn lưới bị che bởi tiêu đề cố định;
- **Chọn nhanh**: sửa chọn tệp nhanh đôi khi mở tệp;
- **Phím tắt terminal**: sửa lỗi `Alt+T` mở terminal tại thư mục hiện tại thay vì tại mục đã chọn;
- **Mở tệp**: sửa tệp mở từ thư mục làm việc sai;
- **Chia sẻ SMB**: sửa không thể mở tệp trên chia sẻ SMB;
- **Đường dẫn WSL**: sửa cách xử lý đường dẫn UNC của máy chủ WSL trên Windows, bao gồm việc dùng `//wsl.localhost` làm danh sách bản phân phối ảo;
- **Trình quản lý tệp mặc định**: sửa đặt trình quản lý tệp mặc định trong bản Microsoft Store;
- **AppImage (Linux)**: sửa `Could not create default EGL display: EGL_BAD_PARAMETER`;
- **Cài tiện ích (Linux)**: sửa lỗi cài đặt tiện ích có bản phân phối gồm nhiều tệp;
- **Chi tiết tiện ích**: sửa kiểu căn chỉnh trang tổng quan;
- **Đánh thức thiết bị**: sửa ứng dụng bị kẹt trạng thái tải sau khi thiết bị đánh thức;
- **Thông báo cập nhật**: sửa thông báo cập nhật hiện cho phiên bản chưa phát hành;
- **RTL**: sửa các vấn đề về bố cục từ phải sang trái;
- **Bản dịch**: sửa chuỗi dịch thiếu và sai;

---

## [2.1.0] - May 2026

**Tóm tắt:** Cải thiện hiệu năng trình điều hướng, hình thu nhỏ được tạo tự động, chủ đề từ tiện ích, in tệp, xem trước tệp, phím tắt mới, cải tiến trình chỉnh sửa địa chỉ, thiết kế lại trung tâm trạng thái và hoàn thiện trải nghiệm thẻ cùng thao tác điều hướng.

- [Tính năng mới](#tính-năng-mới)
  - [In tệp](#in-tệp)
  - [Thả tệp vào thẻ](#thả-tệp-vào-thẻ)
  - [Xem trước tệp trong bảng thông tin](#xem-trước-tệp-trong-bảng-thông-tin)
  - [Cột danh sách trình điều hướng](#cột-danh-sách-trình-điều-hướng)
- [Tiện ích mở rộng](#tiện-ích-mở-rộng)
  - [Chủ đề ứng dụng từ tiện ích](#chủ-đề-ứng-dụng-từ-tiện-ích)
  - [Chủ đề biểu tượng từ tiện ích](#chủ-đề-biểu-tượng-từ-tiện-ích)
- [Cài đặt mới](#cài-đặt-mới)
- [Phím tắt mới](#phím-tắt-mới)
- [Cải thiện trải nghiệm người dùng](#cải-thiện-trải-nghiệm-người-dùng)
  - [Hiệu năng thư mục lớn](#hiệu-năng-thư-mục-lớn)
  - [Tìm kiếm nhanh](#tìm-kiếm-nhanh)
  - [Trình chỉnh sửa địa chỉ](#trình-chỉnh-sửa-địa-chỉ)
  - [Trung tâm trạng thái](#trung-tâm-trạng-thái)
  - [Điều hướng và thẻ](#điều-hướng-và-thẻ)
  - [Quản lý phím tắt](#quản-lý-phím-tắt)
- [Cải thiện giao diện](#cải-thiện-giao-diện)
- [Sửa lỗi](#sửa-lỗi)

### Tính năng mới

#### In tệp

In các tệp đã chọn trực tiếp từ trình điều hướng bằng menu ngữ cảnh, menu thao tác, hoặc `Ctrl+O`.

- **Định dạng hỗ trợ**: hình ảnh, PDF, định dạng văn bản;
- **Thoát nhanh**: đóng màn hình in bằng `Escape`;

![printing](./public/changelog/assets/2.1.0/printing.webp)

#### Thả tệp vào thẻ

Kéo tệp hoặc thư mục lên thẻ để di chuyển hoặc sao chép chúng vào thư mục của một thẻ khác.

- **Thẻ đích**: có thể dùng thẻ làm nơi thả khi kéo tệp trong trình điều hướng;
- **Kích hoạt khi di chuột**: di chuột lên thẻ trong lúc kéo để chuyển sang thẻ đó trước khi thả;
- **Thẻ trong chế độ chia đôi**: nhóm thẻ thư mục vẫn nhận tệp được thả như bình thường và giữ nguyên cấu trúc thẻ của chế độ xem chia đôi;

![file-drop-to-tabs](./public/changelog/assets/2.1.0/file-drop-to-tabs.webp)

#### Xem trước tệp trong bảng thông tin

Bảng thông tin giờ có thể xem trước tất cả kiểu tệp được Quick View hỗ trợ, không chỉ hình ảnh và video.

- **Xem trước phương tiện**: hình ảnh dùng hình thu nhỏ được tạo tự động, video và âm thanh có các nút điều khiển tích hợp, còn PDF được hiển thị trực tiếp;
- **Xem trước văn bản**: tệp văn bản hiển thị nội dung đã giải mã ở dạng gọn, với giới hạn kích thước an toàn;
- **Nội dung không được hỗ trợ**: tệp và thư mục không được hỗ trợ vẫn hiển thị biểu tượng giữ chỗ đơn giản;

![info-panel-file-preview](./public/changelog/assets/2.1.0/info-panel-file-preview.webp)

#### Cột danh sách trình điều hướng

Chế độ xem danh sách có thêm các cột tùy chọn và cho phép quản lý siêu dữ liệu trực tiếp thuận tiện hơn.

- **Cột Ngày tạo**: hiển thị và sắp xếp theo ngày tạo;
- **Cột Thẻ**: hiển thị thẻ trực tiếp trong chế độ xem danh sách, đồng thời cho phép thêm, xóa hoặc chỉnh sửa thẻ ngay trong cột;

![navigator-list-columns](./public/changelog/assets/2.1.0/navigator-list-columns.webp)

### Tiện ích mở rộng

#### Chủ đề ứng dụng từ tiện ích

Tiện ích giờ có thể cung cấp chủ đề màu hoàn chỉnh cho ứng dụng. Các tiện ích chủ đề đã cài đặt sẽ xuất hiện trong bộ chọn chủ đề.

#### Chủ đề biểu tượng từ tiện ích

Tiện ích giờ có thể cung cấp chủ đề biểu tượng cho thư mục và tệp trong trình điều hướng.

- **Lựa chọn riêng**: chọn chủ đề biểu tượng thư mục và tệp độc lập trong `Cài đặt > Giao diện > Chủ đề biểu tượng`;
- **Chủ đề có sẵn và từ tiện ích**: dùng chủ đề biểu tượng mặc định hoặc hệ thống có sẵn, cũng như mọi chủ đề do tiện ích đã bật cung cấp;
- **Quy tắc khớp chủ đề**: chủ đề do tiện ích cung cấp có thể xác định biểu tượng theo phần mở rộng, tên tệp, tên thư mục và trạng thái mở rộng của thư mục;

### Cài đặt mới

- **In đậm chữ trên thẻ đang hoạt động**: in đậm tiêu đề của thẻ đang hoạt động (`Cài đặt > Thẻ > Giao diện thẻ > In đậm chữ trên thẻ đang hoạt động`);

![bold-active-tab-text-setting](./public/changelog/assets/2.1.0/bold-active-tab-text-setting.webp)

### Phím tắt mới

- **Bật/tắt chế độ xem chia đôi** (`Ctrl+S`): hiện hoặc ẩn chế độ xem chia đôi trong trình điều hướng;
- **Khôi phục thẻ đã đóng** (`Ctrl+Shift+T`): khôi phục nhóm thẻ vừa đóng gần nhất;
- **Tạo tệp / thư mục** (`Ctrl+Shift+M` / `Ctrl+Shift+N`): tạo tệp hoặc thư mục mới trong thư mục hiện tại;
- **In tệp đã chọn** (`Ctrl+O`): in tệp đã chọn;
- **Mở đường dẫn đã sao chép** (`Ctrl+Shift+V`): mở đường dẫn hợp lệ từ bảng tạm;
- **Chuyển trang** (`Alt+1` - `Alt+5`): chuyển giữa Trang chủ, Trình điều hướng, Bảng điều khiển, Cài đặt và Tiện ích mở rộng;
- **Điều hướng lịch sử thư mục** (`Alt+Left` / `Alt+Right`): quay lại hoặc tiến trong lịch sử trình điều hướng;
- **Điều hướng lên thư mục cha** (`Alt+Up`): đi tới thư mục cha;
- **Nút lịch sử trên chuột** (`Mouse Button 4` / `Mouse Button 5`): quay lại hoặc tiến tới bằng các nút bên hông chuột;

![create-file-directory-shortcuts](./public/changelog/assets/2.1.0/create-file-directory-shortcuts.webp)

![navigator-shortcuts](./public/changelog/assets/2.1.0/navigator-shortcuts.webp)

### Cải thiện trải nghiệm người dùng

#### Hiệu năng thư mục lớn

Các thao tác điều hướng và tìm kiếm nhanh phản hồi tốt hơn; thư mục chứa nhiều nội dung đa phương tiện cũng sử dụng ít bộ nhớ hơn.

- **Hình thu nhỏ được tạo tự động**: hình ảnh và video dùng hình thu nhỏ có kích thước nhỏ hơn thay vì tải toàn bộ nội dung vào từng thẻ tệp;
- **Hiển thị hình ảnh theo từng giai đoạn**: thẻ hình ảnh trong lưới có thể hiển thị hình thu nhỏ độ phân giải thấp đã làm mờ trong khi chờ hình thu nhỏ hoàn chỉnh;
- **Hủy tạo hình thu nhỏ**: dừng tạo các hình thu nhỏ không còn cần thiết khi thư mục hoặc các mục đang hiển thị thay đổi;
- **Hiệu năng kết xuất**: các mục trong thư mục lớn được kết xuất hiệu quả hơn, còn Quick View sử dụng hình thu nhỏ được tạo tự động cùng danh sách ảo;

![low-res-image-thumbnail-preview](./public/changelog/assets/2.1.0/low-res-image-thumbnail-preview.webp)

#### Tìm kiếm nhanh

Tìm kiếm nhanh giờ có hai chế độ: thụ động và chủ động:

- **Chế độ thụ động**: tự động kích hoạt khi bạn bắt đầu gõ. Chế độ này lọc các mục mà không chuyển tiêu điểm vào ô tìm kiếm, nên không cản trở thao tác điều hướng.
- **Chế độ chủ động**: kích hoạt bằng `Ctrl+F`. Tiêu điểm được chuyển vào ô tìm kiếm và thao tác điều hướng tạm thời bị chặn, giúp bạn chỉnh sửa truy vấn chính xác hơn.

Các thay đổi khác:

- **Gõ để lọc**: nhấn phím chữ hoặc số sẽ luôn bắt đầu tìm kiếm nhanh ở chế độ thụ động trong ngăn đang hoạt động;
- **Điều hướng bàn phím**: mục khớp đầu tiên được tự chọn;
- **Thiết kế cửa sổ bật lên**: cửa sổ tìm kiếm nhanh gọn hơn và không che các mục trong thư mục;

![quick-search](./public/changelog/assets/2.1.0/quick-search.webp)

#### Trình chỉnh sửa địa chỉ

Trình chỉnh sửa địa chỉ giờ có thể mở nhiều loại đường dẫn một cách linh hoạt hơn.

- **Tệp và thư mục**: mở tệp cũng như thư mục từ trình chỉnh sửa địa chỉ;
- **Đường dẫn thường dùng**: chuyển sang chế độ chuyên dùng để mở nhanh các đường dẫn thường xuyên truy cập;
- **Gợi ý**: duyệt mục thư mục, khớp chính xác, đường dẫn gần đây, mục đã gắn thẻ, thư mục người dùng và ổ đĩa hệ thống;
- **Thao tác bàn phím**: điều hướng lùi, tiến, lên và hiện mục trong thư mục cha từ trình chỉnh sửa;

![address-editor](./public/changelog/assets/2.1.0/address-editor.webp)

#### Trung tâm trạng thái

Trung tâm trạng thái giờ là một thành phần gọn trên thanh công cụ, với các nhóm thao tác rõ ràng hơn.

- **Số thao tác đang chạy**: nút trên thanh công cụ mở rộng thành hình viên nang và hiển thị số thao tác đang chạy;
- **Nhóm thao tác**: các thao tác đang chạy và đã hoàn tất được tách riêng; thao tác đã hoàn tất nằm trong một phần có thể thu gọn;
- **Hủy tất cả**: hủy đồng thời mọi thao tác đang chạy từ tiêu đề của phần;
- **Thẻ tác vụ**: thẻ thao tác hiển thị loại và trạng thái rõ ràng hơn, chẳng hạn `Sao chép | Thành công` hoặc `Lưu trữ | Lỗi`;
- **Khôi phục bảng tạm**: thao tác dán xóa bảng tạm ngay khi tác vụ được đưa vào hàng đợi và khôi phục nội dung nếu tác vụ thất bại;

![status-center](./public/changelog/assets/2.1.0/status-center.webp)

#### Điều hướng và thẻ

Thao tác trong trình điều hướng và hành vi của thẻ trở nên nhất quán, dễ đoán hơn.

- **Ổ đĩa trên thanh bên**: nhấp vào ổ đĩa trên thanh điều hướng sẽ mở ổ đĩa đó trong thẻ hiện tại;
- **Thư mục hiện tại**: phần địa chỉ hiện tại được làm nổi bật hơn; nhấp phải vào phần cuối của địa chỉ để mở menu ngữ cảnh;
- **Thẻ đã đóng**: thẻ được khôi phục về vị trí cũ, giữ đúng đường dẫn sau khi mục được đổi tên và chuyển các đường dẫn đã bị xóa về trang chủ;
- **Bố cục thích ứng**: các nút điều hướng trên thanh công cụ thu gọn sớm hơn; trong ngăn rất hẹp, thanh địa chỉ của chế độ xem chia đôi chuyển xuống hàng thứ hai; các thẻ gọn cũng có chiều cao đồng nhất;

![nav-sidebar-drive-current-tab](./public/changelog/assets/2.1.0/nav-sidebar-drive-current-tab.webp)

![current-directory-address-bar](./public/changelog/assets/2.1.0/current-directory-address-bar.webp)

#### Quản lý phím tắt

Chỉnh sửa phím tắt giờ xử lý xung đột và tùy chỉnh rõ hơn.

- **Nhiều tổ hợp phím**: gán nhiều phím tắt cho cùng một thao tác;
- **Phím tắt chưa gán**: bỏ gán phím tắt;
- **Thay thế xung đột**: thay phím tắt xung đột trực tiếp từ lời nhắc xung đột;
- **Menu danh sách phím tắt**: quản lý phím tắt từ menu ngữ cảnh trong danh sách phím tắt;

![shortcut-editor](./public/changelog/assets/2.1.0/shortcut-editor.webp)

#### Kéo và thả

Trong khi kéo tệp, giờ có thể dùng `Alt+Tab` để chuyển sang ứng dụng khác rồi thả tệp ra ngoài SFM mà không cần đưa con trỏ ra khỏi cửa sổ trước.

### Cải thiện giao diện

- **Viền chọn**: cải thiện độ trong suốt và vị trí của viền chọn trong trình điều hướng, kiểu tiêu đề ngăn và hành vi tiêu điểm bàn phím;
- **Thanh thẻ**: cải thiện kiểu thanh thẻ và khả năng nhận biết thẻ đang hoạt động;
- **Chọn chủ đề**: cải thiện thiết kế chọn chủ đề;
- **Truy cập nhanh**: tinh chỉnh giao diện của bảng truy cập nhanh;
- **Màn hình khởi động**: thêm màn hình chào trong lúc ứng dụng khởi động;
- **Khả năng hiển thị cửa sổ bật lên**: giúp các thành phần bán trong suốt trong cửa sổ bật lên dễ nhìn hơn;
- **Gợi ý**: thêm gợi ý cho nhiều nút trên thanh công cụ;
- **Bản dịch**: cải thiện nội dung bản dịch tiếng Nhật và tiếng Việt, đồng thời sắp xếp lại cấu trúc bản địa hóa;

![selection-ring](./public/changelog/assets/2.1.0/selection-ring.webp)

![tab-bar-styles](./public/changelog/assets/2.1.0/tab-bar-styles.webp)

![narrow-window-layout](./public/changelog/assets/2.1.0/narrow-window-layout.webp)

### Sửa lỗi

- **Ổ đĩa ánh xạ**: sửa lỗi không thể kéo và thả tệp ra ngoài từ ổ đĩa mạng đã ánh xạ;
- **Cuộn bằng bàn phím**: sửa lỗi hàng đầu tiên bị tiêu đề cố định che khuất;
- **Đóng băng khi khởi động**: khắc phục trường hợp hiếm khi quá trình khởi động trên Windows bị treo trong nhiều phút do các lệnh gọi hệ thống đồng bộ chạy chậm lúc khởi động và kiểm tra cập nhật;
- **Giải nén lưu trữ**: giữ chế độ tệp Unix khi giải nén lưu trữ;
- **HTTP của tiện ích**: khôi phục cách xử lý các phản hồi non-2xx được xem là lỗi vĩnh viễn và cho phép hủy trong thời gian chờ thử lại;
- **Bảng lệnh**: sửa nút thanh công cụ bảng lệnh khi phím tắt của nó được tùy chỉnh;
- **Chọn phạm vi trong lưới**: sửa lỗi thao tác chọn phạm vi trong chế độ xem lưới chọn cả các mục nằm ngoài phạm vi;
- **Menu ngữ cảnh**: sửa lỗi menu ngữ cảnh của mục đã chọn và thư mục hiện tại vẫn mở sau khi chọn thao tác;
- **Đăng ký phím tắt**: sửa lỗi đăng ký phím tắt sau khi tải lại cửa sổ;
- **Áp dụng chủ đề**: sửa chủ đề đã chọn không áp dụng trong tất cả cửa sổ;
- **Di chuyển trên macOS**: sửa cách xử lý thao tác di chuyển giữa các ổ đĩa trên macOS và cho phép chọn gói ứng dụng làm đích;
- **Trình quản lý tệp mặc định**: giúp quá trình khôi phục Registry của trình quản lý tệp mặc định trên Windows an toàn hơn khi không bật được tính năng hoặc khi phục hồi các giá trị hệ thống trước đó;

![keyboard-scroll-floating-header](./public/changelog/assets/2.1.0/keyboard-scroll-floating-header.webp)

---
## [2.0.0-beta.3] - April 2026

**Tóm tắt:** Hệ thống tiện ích mở rộng với cửa hàng, chia sẻ tệp qua mạng LAN, menu truy cập nhanh, lưu trữ zip, ổ đĩa WSL, chỉnh sửa thẻ, cải thiện xem nhanh và tìm kiếm, cải thiện hiệu ứng hình ảnh, và nhiều cải thiện trải nghiệm người dùng và độ ổn định.

### Tính năng mới

#### Hệ thống tiện ích mở rộng

Hệ thống tiện ích mở rộng đầy đủ với cửa hàng mở.

- **Cửa hàng**: duyệt, cài đặt và quản lý tiện ích mở rộng từ cửa hàng;
- **Cài đặt cục bộ**: bạn có thể cài đặt tiện ích mở rộng từ thư mục cục bộ;
- **Bảng lệnh**: cách mới để kích hoạt lệnh của ứng dụng và tiện ích mở rộng;
- **Khả năng**: tiện ích mở rộng có thể đăng ký phím tắt cục bộ và toàn cục, mục menu ngữ cảnh, cài đặt, toàn bộ trang và lệnh;
- **Quản lý phiên bản**: bạn có thể cài đặt các phiên bản khác nhau của tiện ích mở rộng và bật cập nhật tự động;
- **Bản địa hóa**: tiện ích mở rộng có thể cung cấp bản dịch cho các ngôn ngữ khác nhau;
- **Quản lý tệp nhị phân**: tiện ích mở rộng có thể sử dụng tệp nhị phân (ffmpeg, deno, node, yt-dlp, 7z và bất kỳ tệp nhị phân nào khác);
- **Thực thi trong hộp cát**: tiện ích mở rộng chạy trong hộp cát ESM cô lập với quyền chi tiết;

#### Trình quản lý tệp mặc định

Bạn giờ có thể đặt SFM làm trình quản lý tệp mặc định trên Windows (`Cài đặt > Thử nghiệm`). Khi cài đặt này được bật, hầu hết các thao tác tệp hệ thống sẽ được chuyển đến SFM:

- Biểu tượng ứng dụng File Explorer;
- Phím tắt `Ctrl+E`;
- Hiển thị tệp trong thư mục;
- Hiển thị tải xuống (khi bạn tải tệp trong trình duyệt);
- Lệnh terminal: "start {path}", "code {path}", v.v.
- Và nhiều hơn nữa;

Các chế độ xem hệ thống gốc như "Thùng rác", "Bảng điều khiển" và các chương trình tích hợp sâu tương tự được chuyển lại cho File Explorer gốc.

#### Chia sẻ qua mạng LAN

Chia sẻ và phát trực tuyến tệp và thư mục trên mạng cục bộ của bạn trực tiếp từ ứng dụng.

Truy cập chia sẻ LAN từ nút thanh công cụ trong trình điều hướng hoặc từ menu ngữ cảnh trên bất kỳ tệp hoặc thư mục nào. Khi chia sẻ đang hoạt động, mã QR và URL chia sẻ được hiển thị. Có hai chế độ:

- **Phát trực tuyến**: phát tệp và thư mục đến bất kỳ thiết bị nào trên mạng của bạn qua trình duyệt web;
- **FTP**: chia sẻ tệp qua FTP để truy cập trực tiếp từ các ứng dụng khác. Bạn có thể tải xuống và tải lên tệp từ thiết bị khác đến máy tính;

#### Menu truy cập nhanh

Nút "Bảng điều khiển" trên thanh bên giờ hoạt động như menu truy cập nhanh. Di chuột qua sẽ mở bảng hiển thị các mục Yêu thích và Đã gắn thẻ của bạn.

Tất cả các mục trong bảng là các mục nhập thư mục thực — bạn có thể kéo và thả các mục vào và ra, mở menu ngữ cảnh bằng nhấp chuột phải và thực hiện bất kỳ thao tác tệp chuẩn nào.

Có thể tắt trong `Cài đặt > Giao diện > Mở bảng truy cập nhanh khi di chuột`.

#### Lưu trữ Zip

Nén và giải nén lưu trữ zip trực tiếp từ menu thao tác trình duyệt tệp:

- **Giải nén**: giải nén tệp `.zip` vào thư mục hiện tại hoặc vào thư mục có tên;
- **Nén**: nén các tệp và thư mục đã chọn thành lưu trữ `.zip`;

#### Phát hiện ổ đĩa WSL

Trên Windows, ứng dụng giờ tự động phát hiện các bản phân phối WSL đã cài đặt và hiển thị ổ đĩa của chúng trong trình điều hướng, cho phép bạn duyệt hệ thống tệp WSL một cách tự nhiên.

#### Chỉnh sửa thẻ

Bạn giờ có thể chỉnh sửa tên và màu thẻ. Mở trình chọn thẻ trên bất kỳ tệp hoặc thư mục nào để đổi tên thẻ, thay đổi màu hoặc xóa chúng.

#### Cập nhật trong ứng dụng

Bạn giờ có thể tải xuống và cài đặt cập nhật trực tiếp từ thông báo cập nhật mà không cần rời ứng dụng.

#### Sao chép đường dẫn

Đã thêm tùy chọn "Sao chép đường dẫn" vào menu ngữ cảnh tệp và thư mục.

#### Đóng tab trùng lặp

Đã thêm khả năng đóng các tab trùng lặp từ thanh tab, xóa tất cả các tab trỏ đến cùng một thư mục.

#### Menu ngữ cảnh Trang chủ và Bảng điều khiển

Các mục trên trang chủ và bảng điều khiển giờ có menu ngữ cảnh đầy đủ, tương đương với chức năng có sẵn trong trình điều hướng.

### Cài đặt mới

- **Hiển thị banner phương tiện trang chủ**: hiển thị hoặc ẩn banner phương tiện trang chủ (`Cài đặt > Giao diện > Banner phương tiện trang chủ`);
- **Độ trễ tooltip**: cấu hình độ trễ trước khi tooltip xuất hiện (`Cài đặt > Giao diện > Tooltip`);
- **Thời gian tương đối**: hiển thị dấu thời gian gần đây ở định dạng tương đối, ví dụ "5 phút trước" (`Cài đặt > Chung > Ngày / giờ`);
- **Định dạng ngày và giờ**: cấu hình định dạng tháng, định dạng khu vực, đồng hồ 12 giờ, giây và mili giây (`Cài đặt > Chung > Ngày / giờ`);
- **Làm mờ nền hộp thoại**: đặt cường độ làm mờ cho nền hộp thoại (`Cài đặt > Giao diện > Cài đặt kiểu`);
- **Bộ lọc độ sáng và độ tương phản**: điều chỉnh bộ lọc kiểu độ sáng và độ tương phản cho giao diện ứng dụng (`Cài đặt > Giao diện > Cài đặt kiểu`);
- **Độ sáng phương tiện phủ**: điều chỉnh độ sáng phương tiện phủ hiệu ứng hình ảnh (`Cài đặt > Giao diện > Hiệu ứng hình ảnh`);
- **Chế độ hòa trộn hiệu ứng hình ảnh**: điều chỉnh chế độ hòa trộn cho hiệu ứng hình ảnh, cho phép bạn chọn cách phương tiện nền hòa trộn với giao diện ứng dụng (`Cài đặt > Giao diện > Hiệu ứng hình ảnh`);
- **Tạm dừng video nền**: tạm dừng banner trang chủ và video nền khi ứng dụng không hoạt động hoặc thu nhỏ (`Cài đặt > Giao diện > Hiệu ứng hình ảnh`);
- **Trình quản lý tệp mặc định**: đặt Sigma File Manager làm trình quản lý tệp mặc định trên Windows (`Cài đặt > Thử nghiệm`);
- **Khởi chạy khi đăng nhập hệ thống**: tự động khởi chạy ứng dụng khi bạn đăng nhập hệ thống (`Cài đặt > Chung > Hành vi khởi động`);

### Phím tắt mới

- **Sao chép đường dẫn thư mục hiện tại** (`Ctrl+Shift+C`): sao chép đường dẫn thư mục hiện tại vào bộ nhớ tạm;
- **Tải lại thư mục hiện tại** (`F5`): làm mới danh sách tệp trình điều hướng;
- **Phóng to / thu nhỏ** (`Ctrl+=` / `Ctrl+-`): tăng hoặc giảm tỷ lệ giao diện;
- **Toàn màn hình** (`F11`): bật/tắt chế độ toàn màn hình;

### Ngôn ngữ mới

- **Tiếng Hindi**;
- **Tiếng Urdu**;

### Cải thiện trải nghiệm người dùng

#### Cải tiến xem nhanh

- **Điều hướng phương tiện**: điều hướng giữa các tệp trong thư mục hiện tại mà không cần đóng xem nhanh;
- **Xem trước tệp văn bản**: cải thiện xem trước tệp văn bản với phát hiện mã hóa chính xác, chỉnh sửa trực tiếp và hiển thị markdown đã phân tích;

#### Cải tiến tìm kiếm nhanh

- **Tất cả thuộc tính**: tìm kiếm theo bất kỳ thuộc tính tệp nào — tên, kích thước, số mục, ngày sửa đổi, ngày tạo, ngày truy cập, đường dẫn hoặc loại MIME (ví dụ `modified: today`, `mime: image`);
- **Phạm vi kích thước**: lọc theo kích thước bằng so sánh và phạm vi (ví dụ `size: >=2mb`, `size: 1mb..10mb`);

#### Thao tác tệp

- **An toàn giải quyết xung đột**: cải thiện an toàn tệp trong hộp thoại giải quyết xung đột để ngăn mất dữ liệu vô tình;
- **Dán một lần**: các mục đã sao chép chỉ có thể dán một lần, ngăn dán trùng lặp vô tình;
- **Sao chép văn bản**: cho phép sao chép văn bản giao diện bằng `Ctrl+C` khi không có tệp nào được chọn;

#### Hiệu ứng hình ảnh

- **Trình quản lý nền**: thêm trình quản lý nền vào trang cài đặt để tùy chỉnh nền tập trung;
- **Đặt lại hiệu ứng nền**: thêm nút đặt lại vào cài đặt hiệu ứng nền;

#### Khác

- **Giảm kích thước ứng dụng**: giảm kích thước gói ứng dụng bằng cách loại bỏ hình nền tích hợp độ phân giải cao và sử dụng bản xem trước nén trong trình chỉnh sửa banner phương tiện;
- **Tìm kiếm toàn cục**: hiển thị nút "hiển thị cài đặt" ở trạng thái trống và tăng độ sâu tìm kiếm mặc định;
- **Lối tắt Windows**: tệp `.lnk` giờ mở mục tiêu trong trình điều hướng thay vì khởi chạy bên ngoài;
- **Bảng điều khiển**: cải thiện bố cục phần đã gắn thẻ;
- **Menu ngữ cảnh thanh địa chỉ**: thêm menu ngữ cảnh vào các mục thanh địa chỉ;
- **Menu ngữ cảnh trình điều hướng**: hiển thị menu ngữ cảnh khi nhấp vào vùng trống trong trình điều hướng;
- **Mở trong tab mới**: mở thư mục trong tab mới bằng nhấp chuột giữa;
- **Cuộn tab**: tự động cuộn các tab mới thêm vào vùng nhìn thấy;
- **Tiêu điểm menu**: menu không còn trả tiêu điểm về nút kích hoạt khi đóng bằng nhấp chuột bên ngoài;
- **Đóng tìm kiếm**: đóng tìm kiếm toàn cục bằng `Escape`;
- **Khởi chạy nhanh hơn**: cải thiện nhẹ tốc độ khởi chạy ứng dụng bằng cách tải trước cài đặt trong Rust;
- **Thư mục người dùng**: thêm khả năng thêm và xóa thư mục người dùng trên trang chủ;
- **Giới hạn danh sách**: giảm giới hạn cho các mục danh sách thường xuyên và lịch sử để cải thiện hiệu suất;

### Cải thiện giao diện

- **Biểu tượng thanh công cụ**: thống nhất màu biểu tượng thanh công cụ trong toàn ứng dụng;
- **Hoạt ảnh thẻ**: thêm hiệu ứng xuất hiện lần lượt và mờ dần vào thẻ;
- **Chủ đề sáng**: cải thiện màu sắc và độ tương phản chủ đề sáng;
- **Ổn định khởi chạy**: cải thiện ổn định hình ảnh trong quá trình khởi chạy ứng dụng để giảm nhấp nháy;
- **Thông báo**: cải thiện thiết kế thông báo để nhất quán hơn;
- **Tự động cuộn tab**: tự động cuộn tab đã chọn vào vùng nhìn thấy khi mở trang trình điều hướng;
- **Nhãn đường dẫn gốc**: chuẩn hóa nhãn đường dẫn gốc trên các tab và bảng thông tin;
- **Bản dịch**: cải thiện bản dịch trong toàn ứng dụng;

### Sửa lỗi

- Sửa lỗi giao diện bị đóng băng khi sao chép hoặc di chuyển nhiều mục; thêm tiến trình thao tác tệp vào trung tâm trạng thái;
- Sửa lỗi giao diện bị đóng băng khi xóa nhiều mục; thêm tiến trình xóa vào trung tâm trạng thái;
- Sửa lỗi menu ngữ cảnh trong bố cục lưới không mở cho thư mục hiện tại khi mục khác đã có menu đang mở;
- Sửa lỗi bảng thông tin không hiển thị tất cả thông tin cho thư mục hiện tại;
- Sửa lỗi phím tắt ứng dụng được đăng ký trên cửa sổ xem nhanh thay vì chỉ cửa sổ chính;
- Sửa lỗi tệp kéo từ trình duyệt web không được xử lý;
- Sửa lỗi tên tệp từ URL bên ngoài thả vào không giữ các phần hợp lệ;
- Sửa lỗi banner trang chủ có thể kéo được;
- Sửa lỗi bộ nhớ đệm biểu tượng hệ thống không được phân biệt theo đường dẫn tệp, gây ra biểu tượng sai;
- Sửa lỗi các mục gốc Windows không thể truy cập hiển thị trong trình điều hướng;
- Sửa lỗi phím tắt tùy chỉnh không được nhận diện trên một số bố cục bàn phím;
- Sửa lỗi kết nối SSHFS trên Linux;
- Sửa lỗi thanh địa chỉ tạo mục lịch sử trùng lặp khi nhấp vào đường dẫn;
- Sửa lỗi kết quả tìm kiếm toàn cục không phản hồi điều hướng bàn phím;
- Sửa lỗi kết quả tìm kiếm toàn cục không mở khi nhấp;
- Sửa lỗi trạng thái tìm kiếm toàn cục không đồng bộ sau khi lập chỉ mục tăng dần;
- Sửa lỗi kéo và thả tệp ra ngoài không hoạt động trong một số ứng dụng;
- Sửa lỗi thiết kế huy hiệu phím tắt không nhất quán trong toàn ứng dụng;
- Sửa lỗi khả năng hiển thị cột trình điều hướng trong các bảng hẹp;

---

## [2.0.0-beta.2] - February 2026

**Tóm tắt:** Phím tắt toàn cục, cài đặt mới, tính năng mới, cải thiện bộ lọc tệp, cải thiện thanh địa chỉ, cải thiện banner trang chủ và sửa lỗi.

### Phím tắt toàn cục

Bạn giờ có thể sử dụng phím tắt để tương tác với ứng dụng ngay cả khi nó không được lấy nét.

Phím tắt đã thêm:

- `Win+Shift+E` để hiển thị và lấy nét cửa sổ ứng dụng;

### Cài đặt mới

Đã thêm cài đặt để chọn hành vi khi đóng tab cuối cùng.

![Cài đặt đóng tab cuối cùng](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### Tính năng mới

Đã thêm các tính năng xem trước sớm mới:

- Vị trí mạng: cho phép bạn kết nối vị trí mạng (SSHFS (SSH) / NFS / SMB / CIFS);
- [Linux] Gắn ổ đĩa: cho phép bạn ngắt kết nối vị trí;

### Bộ lọc tệp

Bộ lọc tệp đã được cải thiện:
- Giờ khi bạn chuyển thư mục, nó tự động xóa và đóng;
- Tính năng "lọc khi gõ" kích hoạt trong bảng đã chọn, không phải bảng đầu tiên;

### Thanh địa chỉ

- Cải thiện thiết kế và logic tự động hoàn thành;
- Các dấu phân cách đường dẫn giờ là menu thả xuống cung cấp điều hướng nhanh đến bất kỳ thư mục cha nào;

![Menu dấu phân cách](./public/changelog/assets/beta-2/divider-menus.png)

### Banner trang chủ / Hiệu ứng nền

- Cải thiện thiết kế trình chỉnh sửa banner phương tiện:
  - Menu tùy chọn banner phương tiện giờ mở xuống dưới để tránh che khuất tầm nhìn;
  - Bạn giờ có thể nhấp ra ngoài để đóng trình chỉnh sửa vị trí nền;
  - Ô nhập URL được chuyển lên trên hình nền tùy chỉnh;
- Hình ảnh/video tùy chỉnh có thể được sử dụng trong hiệu ứng hình ảnh nền;
- Đã xóa một số hình ảnh banner phương tiện mặc định;
- Đã thêm hình banner mới "Exile by Aleksey Hoffman";

### Cải thiện trải nghiệm người dùng

- Ứng dụng khôi phục vị trí cửa sổ trước đó khi khởi chạy;
- Tab hiện tại giờ có thể đóng bằng phím tắt `Ctrl+W` hoặc nhấp chuột giữa;
- Tăng kích thước biểu tượng tệp trong chế độ xem bố cục lưới;

### Sửa lỗi

- Sửa lỗi di chuyển tệp giữa các tab đôi khi di chuyển chúng đến vị trí sai;
- Sửa lỗi trình điều hướng đôi khi hiển thị biểu tượng hệ thống sai cho thư mục;
- Sửa lỗi tạo nhiều phiên bản ứng dụng và khay hệ thống;
- Sửa lỗi menu tiện ích mở rộng shell tải lại dữ liệu định kỳ khiến danh sách luôn cuộn lên đầu;

## [2.0.0-beta.1] - February 2026

**Tóm tắt:** Cải thiện lớn về khả năng sử dụng và thiết kế bao gồm điều hướng bàn phím, phím tắt mới, mở trong terminal, tự động làm mới thư mục, kéo và thả, và cải thiện tìm kiếm và chế độ xem danh sách.

### Điều hướng bàn phím

Điều hướng tệp bằng bàn phím với hỗ trợ đầy đủ cho bố cục lưới và danh sách cùng chế độ xem chia đôi.

- Phím mũi tên cho điều hướng không gian trong chế độ xem lưới và điều hướng tuần tự trong chế độ xem danh sách;
- Enter để mở thư mục hoặc tệp đã chọn, Backspace để quay lại;
- Ctrl+Left / Ctrl+Right để chuyển tiêu điểm giữa các bảng chế độ xem chia đôi;
- Ctrl+T để mở thư mục hiện tại trong tab mới;
- Tất cả phím tắt điều hướng có thể tùy chỉnh trong Cài đặt > Phím tắt;

### Tự động làm mới thư mục

Chế độ xem trình điều hướng tự động làm mới khi tệp được tạo, xóa, đổi tên hoặc sửa đổi trong thư mục hiện tại.

- Kích thước tệp tự động cập nhật khi bị thay đổi bởi ứng dụng bên ngoài;
- Giám sát hệ thống tệp hiệu quả với chống rung để tránh làm mới quá mức;
- Cập nhật thông minh dựa trên sự khác biệt chỉ thay đổi các mục bị ảnh hưởng, giữ nguyên vị trí cuộn và lựa chọn;

### Kéo và thả

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

Bạn giờ có thể kéo tệp và thư mục để sao chép/di chuyển chúng dễ dàng. Kéo giữa các bảng, từ hoặc đến danh sách kết quả tìm kiếm, từ hoặc đến ứng dụng bên ngoài.

### Xung đột sao chép

Đã thêm cửa sổ modal để giải quyết xung đột sao chép/di chuyển dễ dàng.

### Cập nhật tự động

Đã thêm tính năng tự động kiểm tra cập nhật (có thể điều khiển từ cài đặt).

### Trình chỉnh sửa phương tiện banner trang chủ

Đã thêm trình chỉnh sửa để tùy chỉnh banner trang chủ. Bạn giờ có thể tải lên hình ảnh và video tùy chỉnh (hỗ trợ cả tệp cục bộ và URL từ xa)

### Cải tiến chế độ xem danh sách

- Cải thiện thiết kế và sửa các vấn đề nhỏ;
- Thêm tùy chỉnh hiển thị cột: chọn cột nào sẽ hiển thị;
- Thêm sắp xếp cột: nhấp tiêu đề cột để sắp xếp các mục;
- Bố cục mặc định trình điều hướng đã chuyển sang chế độ xem danh sách;

### Cải thiện tìm kiếm toàn cục

- Cập nhật bố cục và thiết kế với hỗ trợ kéo và thả;
- Tìm kiếm giờ có sẵn trong khi các ổ đĩa vẫn đang được lập chỉ mục;

### Mở trong terminal

Mở thư mục trong terminal ưa thích trực tiếp từ menu ngữ cảnh.

- Tự động phát hiện terminal đã cài đặt trên Windows, macOS và Linux;
- Windows Terminal hiển thị tất cả cấu hình shell đã cấu hình với biểu tượng tệp thực thi;
- Terminal mặc định Linux được tự động phát hiện và hiển thị đầu tiên;
- Bao gồm chế độ bình thường và quản trị/nâng cao;
- Phím tắt mặc định: Alt+T;

### Bản địa hóa

- Đã thêm tiếng Slovenia (cảm ơn: @anderlli0053);

### Cải thiện giao diện / trải nghiệm người dùng

- Thêm bộ chọn phông chữ: chọn phông chữ giao diện từ phông chữ hệ thống đã cài đặt;
- Thêm menu "Tạo mới" để tạo nhanh tệp hoặc thư mục;
- Hiển thị chế độ xem trạng thái trống khi điều hướng đến thư mục trống;
- Thanh trạng thái hiển thị tổng số mục với số lượng ẩn khi danh sách bị lọc;
- Các mục mới tạo, sao chép và di chuyển tự động cuộn vào vùng nhìn thấy;
- Thanh công cụ bộ nhớ tạm hiển thị một lần bên dưới các bảng thay vì trong mỗi bảng;
- Đơn giản hóa thiết kế hộp thoại đổi tên;
- Biểu tượng thanh công cụ phản hồi thu gọn thành menu thả xuống ở kích thước cửa sổ nhỏ;
- Xóa tab "Điều hướng" trống từ cài đặt;
- Đổi tên thư mục giờ cập nhật đường dẫn trong tất cả tab, không gian làm việc, mục yêu thích, thẻ, lịch sử và mục thường xuyên;
- Xóa tệp hoặc thư mục giờ loại bỏ nó khỏi tất cả danh sách đã lưu và điều hướng các tab bị ảnh hưởng về trang chủ;
- Các đường dẫn không tồn tại trong mục yêu thích, thẻ, lịch sử và mục thường xuyên giờ được tự động dọn dẹp khi khởi động;

### Sửa lỗi

- Sửa lỗi trạng thái lập chỉ mục tìm kiếm toàn cục không cập nhật theo thời gian thực;
- Sửa lỗi bảng chế độ xem chia đôi không cập nhật khi thư mục bị xóa hoặc đổi tên từ bảng kia;
- Sửa lỗi tab tải lỗi khi đường dẫn lưu trữ không còn tồn tại;
- Sửa lỗi biểu tượng hệ thống hiển thị cùng biểu tượng cho tất cả tệp cùng loại thay vì biểu tượng riêng cho từng tệp;
- Sửa lỗi phím tắt không hoạt động trong bảng thứ hai của chế độ xem chia đôi;
- Sửa lỗi phím tắt ngừng hoạt động sau khi điều hướng trang;
- Sửa lỗi rò rỉ bộ nhớ do trình lắng nghe sự kiện phím bộ lọc không được dọn dẹp khi gỡ bỏ;
- Linux: thêm hỗ trợ truy xuất ứng dụng mặc định trong menu "mở bằng";

---

## [2.0.0-alpha.6] - January 2026

**Tóm tắt:** Cửa sổ Có gì mới, Xem nhanh, cải tiến menu ngữ cảnh và cài đặt mới.

### Cửa sổ Có gì mới

Cửa sổ nhật ký thay đổi hiển thị các tính năng và cải thiện mới cho mỗi phiên bản.

- Tự động xuất hiện sau khi cập nhật (có thể tắt);
- Duyệt qua tất cả các phiên bản;
- Xem mô tả chi tiết và ảnh chụp màn hình cho mỗi tính năng;

### Xem nhanh

Xem trước tệp mà không cần mở hoàn toàn bằng cửa sổ xem trước nhẹ.

- Nhấn `Space` hoặc tùy chọn "Xem nhanh" trong menu ngữ cảnh để xem nhanh tệp;
- Đóng ngay lập tức bằng `Space` hoặc `Escape`.
- Hỗ trợ hình ảnh, video, âm thanh, tệp văn bản, PDF và nhiều hơn nữa;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### Tính toán kích thước thư mục

- Kích thước thư mục giờ được tính tự động;
- Bạn có thể thấy tổng kích thước của tất cả thư mục, bao gồm tất cả thư mục con và tệp, ngay khi bạn mở bất kỳ thư mục nào;

![Mở bằng](./public/changelog/assets/alpha-6/size.png)

### Tùy chọn menu ngữ cảnh mới

#### Mở bằng

- Chọn ứng dụng để mở tệp;
- Thiết lập cài đặt trước tùy chỉnh để mở tệp trong ứng dụng với cờ;
- Xem tất cả ứng dụng tương thích cho bất kỳ loại tệp nào;
- Đặt ứng dụng mặc định cho các loại tệp cụ thể;

![Mở bằng](./public/changelog/assets/alpha-6/open-with.png)

#### Tiện ích mở rộng Shell

- Truy cập các mục menu ngữ cảnh shell Windows;
- Truy cập tiện ích mở rộng shell bên thứ ba (7-Zip, Git, v.v.);

![Tiện ích mở rộng Shell](./public/changelog/assets/alpha-6/shell-extensions.png)

### Cài đặt mới

#### Phát hiện ổ đĩa

- Lấy nét ứng dụng khi kết nối ổ đĩa di động (có thể tắt);
- Kiểm soát hành vi tự động mở Windows Explorer cho ổ đĩa di động;

#### Lọc khi gõ

Bắt đầu gõ ở bất kỳ đâu trong trình điều hướng để lọc ngay các mục trong thư mục hiện tại;

#### Phím tắt tìm kiếm cài đặt

Phím tắt mới để truy cập nhanh tìm kiếm cài đặt;

#### Dữ liệu thống kê người dùng

- Đã thêm phần cài đặt thống kê;
- Trên trang bảng điều khiển, bạn có thể xem, điều hướng, xóa lịch sử, mục yêu thích và mục thường xuyên;

### Cải thiện tìm kiếm

Cải thiện tìm kiếm toàn cục với hệ thống tìm kiếm kết hợp có lập chỉ mục + trực tiếp cho kết quả đáng tin cậy và cập nhật hơn.

- Tìm kiếm giờ luôn mất dưới 1 giây (~1 TB ổ đĩa đầy hoàn toàn), bất kể tệp ở đâu trên ổ đĩa;
- Khi bạn tìm kiếm "đường dẫn ưu tiên" (những đường dẫn bạn mở thường xuyên), bạn nhận kết quả ngay lập tức và tìm được tệp ngay cả khi chúng vừa được tạo và chưa được lập chỉ mục.

#### Đường dẫn ưu tiên bao gồm:
- Thư mục người dùng: Tải xuống, Tài liệu, Máy tính để bàn, Hình ảnh, Video, Âm nhạc;
- Mục yêu thích;
- Mở gần đây;
- Thường xuyên sử dụng;
- Đã gắn thẻ;

---

## [2.0.0-alpha.5] - January 2026

**Tóm tắt:** Thao tác tệp, tìm kiếm toàn cục và tùy chỉnh phím tắt.

### Tìm kiếm toàn cục

Tìm kiếm toàn đĩa mạnh mẽ, lập chỉ mục và tìm kiếm tệp trên tất cả các ổ đĩa. Có tính năng khớp mờ để tìm tệp ngay cả khi có lỗi chính tả, tự động lập chỉ mục lại định kỳ, lập chỉ mục ưu tiên cho thư mục thường dùng và quét song song tùy chọn để lập chỉ mục nhanh hơn.

![Tìm kiếm toàn cục](./public/changelog/assets/alpha-5/search.png)

### Thao tác tệp

Hỗ trợ đầy đủ thao tác tệp với chức năng sao chép, di chuyển và xóa bao gồm theo dõi tiến trình. Cũng bao gồm đổi tên tệp và thư mục tại chỗ.

### Trình chỉnh sửa phím tắt

Tùy chỉnh tất cả phím tắt trong ứng dụng. Xem liên kết hiện tại, phát hiện xung đột và đặt lại về mặc định.

### Cải tiến trình điều hướng

Đã thêm tùy chọn hiển thị biểu tượng hệ thống gốc cho tệp và thư mục thay vì ký hiệu tối giản. Các tab điều hướng cài đặt giờ dính vào trang khi cuộn.

---

## [2.0.0-alpha.4] - January 2026

**Tóm tắt:** Trang chủ, hiệu ứng hình ảnh và tùy chọn tùy chỉnh người dùng.

### Trang chủ

Trang chủ đẹp với banner phương tiện hoạt hình, danh sách ổ đĩa và truy cập nhanh đến các thư mục người dùng phổ biến như Tài liệu, Tải xuống, Hình ảnh và nhiều hơn nữa.

### Hiệu ứng hình ảnh

Phần hiệu ứng hình ảnh có thể tùy chỉnh trong cài đặt, thêm hiệu ứng làm mờ, độ trong suốt và nhiễu vào nền ứng dụng. Hỗ trợ cài đặt khác nhau cho mỗi trang.

### Trình chỉnh sửa thư mục người dùng

Tùy chỉnh thẻ thư mục người dùng với tiêu đề, biểu tượng và đường dẫn tùy chỉnh. Cá nhân hóa cách hiển thị thư mục truy cập nhanh trên trang chủ.

### Trình chỉnh sửa vị trí banner

Tinh chỉnh vị trí hình nền banner trang chủ. Điều chỉnh phóng to, vị trí ngang và dọc để có giao diện hoàn hảo.

### Cải thiện cài đặt

- Tìm kiếm cài đặt giờ hoạt động ở bất kỳ ngôn ngữ nào, không chỉ ngôn ngữ hiện tại;
- Ứng dụng sẽ khôi phục tab cài đặt đã truy cập lần cuối khi tải lại thay vì mở tab đầu tiên mỗi lần;

---

## [2.0.0-alpha.3] - December 2025

**Tóm tắt:** Chế độ xem trình điều hướng với tab, không gian làm việc và hệ thống thiết kế mới.

### Chế độ xem trình điều hướng

Trải nghiệm duyệt tệp cốt lõi với hệ thống tab hiện đại hỗ trợ không gian làm việc, thiết kế thanh công cụ cửa sổ mới với điều khiển tích hợp và điều hướng hai bảng để quản lý tệp hiệu quả.

### Hình thu nhỏ video

Đã thêm hình thu nhỏ xem trước cho tệp video trong trình điều hướng.

### Chuyển đổi hệ thống thiết kế

Chuyển ứng dụng từ Vuetify sang Sigma-UI để có thiết kế rộng rãi, hiện đại hơn với chất lượng mã được cải thiện.

---

## [2.0.0-alpha.1] - January 2024

**Tóm tắt:** Viết lại hoàn toàn sử dụng công nghệ hiện đại.

### Chuyển sang Tauri

Sigma File Manager v2 đã được xây dựng lại từ đầu sử dụng Vue 3 Composition API, TypeScript và Tauri v2. Kích thước cài đặt ứng dụng giảm từ 153 MB xuống chỉ 4 MB trên Windows. Kích thước ứng dụng đã cài đặt giảm từ 419 MB xuống 12 MB.

### Bảng có thể thay đổi kích thước

Đã thêm tính năng bảng có thể thay đổi kích thước cho phép bạn chia đôi chế độ xem trình điều hướng và làm việc với 2 thư mục cạnh nhau.

### Tính năng ban đầu

Điều hướng tệp cơ bản với danh sách thư mục, quản lý cửa sổ với điều khiển thu nhỏ, phóng to và đóng, và cấu trúc trang cài đặt ban đầu.
