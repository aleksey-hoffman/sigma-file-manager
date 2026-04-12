# Nhật ký thay đổi

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
